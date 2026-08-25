import paypal from '@paypal/checkout-server-sdk';

export default async function handler(req, res) {
    const { orderID } = req.body;

    const client = new paypal.core.PayPalHttpClient(
        new paypal.core.LiveEnvironment(
            process.env.PAYPAL_CLIENT_ID,
            process.env.PAYPAL_SECRET
        )
    );

    const request = new paypal.orders.OrdersCaptureRequest(orderID);
    request.requestBody({});

    const capture = await client.execute(request);
    res.status(200).json({ status: capture.result.status });
}
