
// api/review-webhook.js

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const data = req.body;

    if (!data.customerEmail) {
      console.log("❌ 차단됨 - 이메일 없음");
      return res.status(400).json({ message: "Ignored - No Email" });
    }

    // Supabase 연동
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const response = await fetch(`${SUPABASE_URL}/rest/v1/review_webhook_test`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        id: data.id,
        customer_email: data.customerEmail,
        review_message: data.reviewMessage || "",
        product_id: data.productId || "",
        product_name: data.productName || "",
        date_created: data.dateCreated || "",
        review_options_list: data.reviewOptionsList || []
      })
    });

    console.log("📦 Supabase 저장 응답", await response.text());

    // Shopify 메타필드 저장
    await updateShopifyMetafields(data.customerEmail, data.reviewOptionsList || []);

    return res.status(200).json({ message: "✅ OK" });

  } catch (error) {
    console.error("❌ 오류 발생:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

async function updateShopifyMetafields(email, optionsList) {
  const SHOPIFY_TOKEN = process.env.SHOPIFY_TOKEN;
  const SHOP = "andar-japan.myshopify.com";
  const VERSION = "2025-04";

  const heightValue = optionsList.find(opt => opt.message?.includes("身長"))?.value || null;
  const weightValue = optionsList.find(opt => opt.message?.includes("体重"))?.value || null;

  if (!heightValue && !weightValue) {
    console.log("ℹ️ Skip - 신장/체중 없음");
    return;
  }

  const searchUrl = `https://${SHOP}/admin/api/${VERSION}/customers/search.json?query=email:${encodeURIComponent(email)}`;
  const customerRes = await fetch(searchUrl, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": SHOPIFY_TOKEN
    }
  });

  const customerData = await customerRes.json();
  const customer = customerData.customers?.[0];
  if (!customer) {
    console.log("❌ 고객 없음:", email);
    return;
  }

  const customerId = customer.id;
  const metafieldUrl = `https://${SHOP}/admin/api/${VERSION}/customers/${customerId}/metafields.json`;

  const metafields = [];

  if (heightValue) {
    metafields.push({
      metafield: {
        namespace: "review",
        key: "height",
        type: "single_line_text_field",
        value: heightValue
      }
    });
  }

  if (weightValue) {
    metafields.push({
      metafield: {
        namespace: "review",
        key: "weight",
        type: "single_line_text_field",
        value: weightValue
      }
    });
  }

  for (const body of metafields) {
    const metaRes = await fetch(metafieldUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": SHOPIFY_TOKEN
      },
      body: JSON.stringify(body)
    });

    const metaResult = await metaRes.text();
    console.log("📝 메타필드 응답", metaResult);
  }
}
