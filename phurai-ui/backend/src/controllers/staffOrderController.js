import { OrderSplitService } from "../services/orderSplitService.js";

function jsonError(res, message, status = 500) {
  return res.status(status).json({ success: false, message });
}

export async function splitOrderItems(req, res) {
  try {
    const parentOrderId = Number(req.params.orderId);
    const { items } = req.body; // Array of { order_item_id, split_quantity }

    if (!Number.isFinite(parentOrderId) || parentOrderId <= 0) {
      return jsonError(res, "Invalid order id.", 400);
    }

    if (!Array.isArray(items) || items.length === 0) {
      return jsonError(res, "Provide an array of items to split.", 400);
    }

    // Call service to perform the split
    const result = await OrderSplitService.splitOrderItems(parentOrderId, items);

    // Emit socket event to notify other clients
    const io = req.app.get("io");
    if (io) {
      io.to("room:staff").to("room:manager").emit("order:sync", { 
        action: "split", 
        table_id: result.tableId,
        parent_order_id: result.parentOrderId,
        child_order_id: result.childOrderId 
      });
      // also notify table sync if necessary
      io.to("room:staff").to("room:manager").emit("table:sync", { 
        action: "order_split", 
        table_id: result.tableId 
      });
    }

    return res.json({
      success: true,
      message: "Order split successfully.",
      data: result
    });
  } catch (error) {
    console.error("splitOrderItems failed:", error);
    return jsonError(res, error.message || "Could not split order.");
  }
}
