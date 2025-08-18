// server.js
const express = require("express");
const admin = require("firebase-admin");

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Firebase Admin
const serviceAccount = require("./credentials.json"); // <- your Firebase admin SDK key file

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const fcm = admin.messaging();

// API endpoint
app.get("/notify/:groupId/:userId", async (req, res) => {
  const { groupId, userId } = req.params;

  try {
    // 1. Get group details
    const groupDoc = await db.collection("tainted-groups").doc(groupId).get();
    if (!groupDoc.exists) {
      return res.status(404).json({ error: "Group not found" });
    }

    const groupData = groupDoc.data();
    const members = groupData.members || [];
    const timeline = groupData.timeline || [];

    if (timeline.length === 0) {
      return res.status(400).json({ error: "No timeline entries found" });
    }


    // 3. Collect FCM tokens
    const tokens = [];
    let title_string;
    console.log(`userId: ${userId}`);
    for (const memberId of members) {
        const userDoc = await db.collection("tainted-users").doc(memberId).get();
        if (userDoc.exists) {
        const userData = userDoc.data();
        if (memberId == userId){
                title_string = `${userData.name}, is getting stronger!`;
                continue; // Skip the user who triggered the notification
        }
        console.log(title_string);
        console.log(`Processing user: ${userData.name} (${memberId})`);
        if (userData.fcm_token) { // Skip the user who triggered the notification
            
            tokens.push(userData.fcm_token);
        }
      }
    }

    if (tokens.length === 0) {
      return res.status(400).json({ error: "No valid FCM tokens found" });
    }

    // 4. Send notification
    const message = {
      notification: {
        title: title_string || "Everyone's in the community is building themselves!",
        body: `He just completed a habit. Enter the ${groupData.name} community to see what's happening!`,
      },
      tokens: tokens,
    };

    // Use sendEachForMulticast instead of sendMulticast
    const response = await fcm.sendEachForMulticast(message);

    res.json({
      success: true,
      message: "Notifications sent",
      response,
    });

  } catch (error) {
    console.error("Error sending notification:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
