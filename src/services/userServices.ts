
import { db } from '../lib/firebase-admin';
import { UserProfile } from '../models/UserProfile';
import { Timestamp } from 'firebase-admin/firestore';

export const upsertUser = async (user: {
    email: string;
    name?: string;
    image?: string;
    deviceTokens?: Array<string>;
}) => {
    if (!user.email) throw new Error('Missing email');

    const userRef = db.collection('users').doc(user.email);
    const doc = await userRef.get();

    const timestamp = Timestamp.now();

    if (!doc.exists) {
        const userProfile: UserProfile = {
            id: user.email,
            email: user.email,
            name: user.name,
            image: user.image,
            createdAt: timestamp,
            updatedAt: timestamp,
            deviceTokens: user.deviceTokens
        };
        await userRef.set(userProfile);
    } else {
        await userRef.update({ updatedAt: timestamp });
    }

    return userRef.id;
};
