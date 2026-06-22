import sql from "mssql";
import { getRawPool } from "../db.js";
import { OrderRepository } from "../repositories/OrderRepository.js";
import { OrderItemRepository } from "../repositories/OrderItemRepository.js";

export class OrderSplitService {
  /**
   * Calculates subtotal and total for a list of items.
   * Assumes discount and service_charge are flat 0 for the split items,
   * or they should be proportionally split. For simplicity, we recalculate subtotal = total_amount.
   */
  static calculateTotals(items) {
    let subtotal = 0;
    for (const item of items) {
      subtotal += item.quantity * Number(item.unit_price);
    }
    // In a full implementation, we might proportionally divide discount/service_charge.
    // For now, we set total = subtotal.
    return {
      subtotal,
      discountAmount: 0,
      serviceCharge: 0,
      totalAmount: subtotal,
    };
  }

  /**
   * Split order items into a new child order on the same table.
   * @param {number} parentOrderId 
   * @param {Array<{ order_item_id: number, split_quantity: number }>} itemsToSplit 
   */
  static async splitOrderItems(parentOrderId, itemsToSplit) {
    if (!itemsToSplit || itemsToSplit.length === 0) {
      throw new Error("No items provided to split.");
    }

    const pool = await getRawPool();
    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin();

      // 1. Fetch parent order with lock
      const parentOrder = await OrderRepository.getOrderForUpdate(transaction, parentOrderId);
      if (!parentOrder) {
        throw new Error("Parent order not found.");
      }

      if (parentOrder.order_status === "Paid" || parentOrder.order_status === "Cancelled") {
        throw new Error("Cannot split a Paid or Cancelled order.");
      }

      // 2. Fetch all order items for the parent order with lock
      const allParentItems = await OrderItemRepository.getOrderItemsForUpdate(transaction, parentOrderId);
      if (allParentItems.length === 0) {
        throw new Error("Parent order has no items.");
      }

      // 3. Create Child Order
      const childOrderId = await OrderRepository.createChildOrder(transaction, parentOrder);

      const splitRequestsMap = new Map();
      for (const req of itemsToSplit) {
        if (req.split_quantity <= 0) continue;
        splitRequestsMap.set(req.order_item_id, req.split_quantity);
      }

      if (splitRequestsMap.size === 0) {
        throw new Error("Invalid split quantities.");
      }

      let childItems = [];

      // 4. Process each item to split
      for (const item of allParentItems) {
        const splitQty = splitRequestsMap.get(item.order_item_id) || 0;
        if (splitQty === 0) continue;

        if (splitQty > item.quantity) {
          throw new Error(`Cannot split ${splitQty} from item ${item.order_item_id} (only ${item.quantity} available).`);
        }

        if (splitQty === item.quantity) {
          // Transfer entire item
          await OrderItemRepository.transferItemToOrder(transaction, item.order_item_id, childOrderId);
          childItems.push({ ...item, quantity: splitQty });
          item.quantity = 0; // Mark as removed from parent
        } else {
          // Partial split
          await OrderItemRepository.reduceItemQuantity(transaction, item.order_item_id, splitQty);
          await OrderItemRepository.insertOrderItem(transaction, childOrderId, item, splitQty);
          childItems.push({ ...item, quantity: splitQty });
          item.quantity -= splitQty; // Update parent memory
        }
      }

      // 5. Recalculate totals
      const remainingParentItems = allParentItems.filter(i => i.quantity > 0);
      
      if (remainingParentItems.length === 0) {
        throw new Error("Cannot split ALL items into a new bill. Just use the original bill.");
      }

      const parentTotals = this.calculateTotals(remainingParentItems);
      const childTotals = this.calculateTotals(childItems);

      // We should distribute the original order's discount and service_charge proportionally,
      // but for simplicity, we recalculate purely based on item subtotal here.
      // In a real scenario, you'd apply business rules for proportional discounts.
      await OrderRepository.updateOrderTotals(transaction, parentOrderId, parentTotals.subtotal, 0, 0, parentTotals.totalAmount);
      await OrderRepository.updateOrderTotals(transaction, childOrderId, childTotals.subtotal, 0, 0, childTotals.totalAmount);

      await transaction.commit();

      return {
        parentOrderId,
        childOrderId,
        tableId: parentOrder.table_id
      };
    } catch (error) {
      if (transaction) await transaction.rollback();
      throw error;
    }
  }
}
