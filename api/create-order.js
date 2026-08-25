import paypal from '@paypal/checkout-server-sdk';

export default async function handler(req, res) {
    const client = new paypal.core.PayPalHttpClient(
        new paypal.core.LiveEnvironment(
            process.env.PAYPAL_CLIENT_ID,
            process.env.PAYPAL_SECRET
        )
    );

    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
        intent: "CAPTURE",
        purchase_units: [{
            amount: {
                currency_code: "USD",
                value: "50.00" // or dynamic cart total
            }
        }]
    });

    const order = await client.execute(request);
    res.status(200).json({ id: order.result.id });
}
