// import cron from 'node-cron';

// cron.schedule('0 12 * * *', async () => {
//   const users = await getAllUsers();

//   for (const user of users) {
//     const receipts = await getYesterdayReceipts(user.id);
//     const content = await generateNotificationFromReceipts(receipts);

//     if (content) {
//       await sendNotification(user.id, content);
//     }
//   }
// });
