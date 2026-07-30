import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

let genAI = null;

function getGenAI() {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is missing in environment variables.");
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

const reportIntentSchema = {
  type: SchemaType.OBJECT,
  properties: {
    report_type: {
      type: SchemaType.STRING,
      description: "Type of report requested. Allowed: revenue_detail, revenue_summary, reservation_stats, top_dishes, custom_filtered",
      enum: ["revenue_detail", "revenue_summary", "reservation_stats", "top_dishes", "custom_filtered"]
    },
    date_range: {
      type: SchemaType.OBJECT,
      description: "Date range for the report (YYYY-MM-DD)",
      properties: {
        from: { type: SchemaType.STRING },
        to: { type: SchemaType.STRING }
      },
      required: ["from", "to"]
    },
    granularity: {
      type: SchemaType.STRING,
      description: "Data grouping level. Allowed: month, quarter, custom",
      enum: ["month", "quarter", "custom"]
    },
    customer_type_filter: {
      type: SchemaType.STRING,
      description: "Filter for customer source. Allowed: all, walkin, reservation_system",
      enum: ["all", "walkin", "reservation_system"]
    },
    filters: {
      type: SchemaType.OBJECT,
      description: "Whitelisted filter conditions extracted from request",
      properties: {
        customer_type: {
          type: SchemaType.STRING,
          description: "Customer source filter. Allowed: all, walkin, reservation_system",
          enum: ["all", "walkin", "reservation_system"]
        },
        area_name: {
          type: SchemaType.STRING,
          description: "Restaurant area filter. Allowed: all, Window Area, Standard Area, Premium Area, VIP Lounge, Private Room, Kitchen View, Rooftop Outdoor, Wine Bar, Event Corner, Rooftop Terrace",
          enum: ["all", "Window Area", "Standard Area", "Premium Area", "VIP Lounge", "Private Room", "Kitchen View", "Rooftop Outdoor", "Wine Bar", "Event Corner", "Rooftop Terrace"]
        },
        table_id: {
          type: SchemaType.NUMBER,
          description: "Optional specific table ID if named by manager"
        }
      },
      required: ["customer_type", "area_name"]
    },
    columns_requested: {
      type: SchemaType.ARRAY,
      description: "List of exact columns requested by the user. Only include standard columns requested.",
      items: {
        type: SchemaType.STRING,
        enum: ["reservation_id", "customer_name", "date", "time", "table_id", "order_item", "total_amount", "customer_type"]
      }
    },
    include_grand_total: {
      type: SchemaType.BOOLEAN,
      description: "Whether the user requested a total sum row at the bottom."
    },
    output_format: {
      type: SchemaType.STRING,
      description: "Requested format. Allowed: chat_view, excel, pdf",
      enum: ["chat_view", "excel", "pdf"]
    },
    scope_note: {
      type: SchemaType.STRING,
      description: "Short note on what the user specifically asked for, to guide filtering."
    }
  },
  required: [
    "report_type", 
    "date_range", 
    "granularity", 
    "customer_type_filter", 
    "filters",
    "columns_requested", 
    "include_grand_total", 
    "output_format"
  ]
};

export async function parseReportIntent(promptText) {
  const model = getGenAI().getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: reportIntentSchema,
    }
  });

  const systemInstruction = `
    You are an intelligent assistant for a Restaurant Manager. 
    Your goal is to parse the Manager's natural language request into a strictly structured JSON object for generating reports.
    
    Current Date/Time context: ${new Date().toISOString()}
    
    RULES:
    - Determine the 'report_type' strictly from the allowed enums.
      * revenue_detail: detailed list of orders/reservations with amounts
      * revenue_summary: just total revenue over a period
      * reservation_stats: booking counts, no money
      * top_dishes: best selling items
      * custom_filtered: very specific ad-hoc request (e.g. "chỉ cho xem walk-in")
    - Determine 'date_range' accurately from the prompt (e.g. "tháng này", "hôm nay"). If not specified, default to the current month.
    - Set 'include_grand_total' to true if they ask for "dòng tổng", "tổng cộng", etc.
    - Set 'output_format' to "excel" if they mention excel, "pdf" if they mention pdf/in, else "chat_view".
    - Populate 'columns_requested' with what they explicitly asked for. If they say "đầy đủ cột", use: ["reservation_id", "customer_name", "date", "time", "table_id", "order_item", "total_amount", "customer_type"].
    - You CANNOT generate SQL. Only output the JSON structure.
  `;

  const result = await model.generateContent([
    systemInstruction,
    promptText
  ]);

  const jsonText = result.response.text();
  return JSON.parse(jsonText);
}
