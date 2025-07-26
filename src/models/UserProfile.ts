import { Timestamp } from 'firebase-admin/firestore';

export interface UserProfile {
  id: string; // UID from next-auth (email or sub)
  name?: string;
  email: string;
  image?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deviceTokens?: Array<string>;
}
