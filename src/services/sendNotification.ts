import { messaging } from "firebase-admin";
import { admin } from "../lib/firebase-admin";

export const sendNotification = async ({ token, title, body }: any) => {
  try {
    const message: messaging.Message = {
      token,
      notification: {
        title: title || "Test Notification",
        body: body || "Hello from Fastify!",
        imageUrl:
          "https://png.pngtree.com/png-clipart/20240318/original/pngtree-tree-forest-tree-png-image_14619746.png",
      },
    };

    const data = await admin.messaging().send(message);
    console.log("message here", data);

    // const data = await res.json();
    return data;
  } catch (error) {
    console.log("hi error here", error);
    return error;
  }
};
