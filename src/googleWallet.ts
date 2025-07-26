import { google } from "googleapis";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";

dotenv.config();

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
  [key: string]: any;
}

class GoogleWalletManager {
  credentials: ServiceAccountCredentials;
  issuerId: string | undefined;
  authClient: any;
  walletobjects: any;

  constructor() {
    this.issuerId = process.env.WALLET_ISSUER_ID;
    if (!this.issuerId) {
      throw new Error("WALLET_ISSUER_ID not set in .env");
    }

    const keyFilePath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!keyFilePath) {
      throw new Error(
        "GOOGLE_APPLICATION_CREDENTIALS (path to key file) not set in .env"
      );
    }

    try {
      const fileContent = fs.readFileSync(keyFilePath, "utf8");
      this.credentials = JSON.parse(fileContent);
      console.log(
        "this.credentials (client_email only for safety):",
        this.credentials.client_email
      );
    } catch (error: any) {
      throw new Error(
        `Failed to read or parse service account key file from ${keyFilePath}: ${error.message}`
      );
    }

    this.authClient = new google.auth.JWT({
      email: this.credentials.client_email,
      key: this.credentials.private_key,
      scopes: ["https://www.googleapis.com/auth/wallet_object.issuer"],
    });

    this.walletobjects = google.walletobjects({
      version: "v1",
      auth: this.authClient,
    });
  }

  async createGenericClass(classSuffix: any) {
    const classId = `${this.issuerId}.${classSuffix}`;
    console.log(`Attempting to create GenericClass with ID: ${classId}`);

    try {
      const classData = {
        id: classId,
        issuerName: "My Custom Text Issuer",
        // Remove textModulesData from class definition - it belongs in objects
      };

      const response: any = await this.walletobjects.genericclass.insert({
        resource: classData,
      });
      console.log("GenericClass created successfully:", response.data);
      return response.data;
    } catch (error: any) {
      if (error.code === 409) {
        console.warn(
          `GenericClass ${classId} already exists. Skipping creation.`
        );
        const response = await this.walletobjects.genericclass.get({
          resourceId: classId,
        });
        return response.data;
      } else {
        console.error(
          "Error creating GenericClass:",
          error.response ? error.response.data : error.message
        );
        throw error;
      }
    }
  }

  async createGenericObject(
    classSuffix: any,
    objectSuffix: any,
    extractedTextData: any
  ) {
    const classId = `${this.issuerId}.${classSuffix}`;
    const objectId = `${this.issuerId}.${objectSuffix}`;
    console.log(
      `Attempting to create GenericObject with ID: ${objectId}w2 for Class ID: ${classId}`
    );

    try {
      // Validate that we have meaningful content
      const primaryText =
        extractedTextData.primaryText?.trim() || "No content available";
      const detailText =
        extractedTextData.detailText?.trim() || "No additional information";
      const cardTitle =
        extractedTextData.cardTitle?.trim() || "Extracted Text Pass";

      const objectData = {
        id: objectId,
        classId: classId,
        state: "ACTIVE",
        // REQUIRED: Header field for the pass
        header: {
          defaultValue: {
            language: "en-US",
            value: "Receipt Scan",
          },
        },
        // REQUIRED: Card title field for the pass
        cardTitle: {
          defaultValue: {
            language: "en-US",
            value: cardTitle,
          },
        },
        // Optional: Additional text content
        textModulesData: [
          {
            header: "Extracted Content",
            body: primaryText,
            id: "extractedText1",
          },
          {
            header: "Additional Info",
            body: detailText,
            id: "extractedText2",
          },
        ],
      };

      console.log("Sending object data:", JSON.stringify(objectData, null, 2));

      const response = await this.walletobjects.genericobject.insert({
        resource: objectData,
      });
      console.log("GenericObject created successfully:", response.data);
      return response.data;
    } catch (error: any) {
      if (error.code === 409) {
        console.warn(
          `GenericObject ${objectId} already exists. Skipping creation.`
        );
        const response = await this.walletobjects.genericobject.get({
          resourceId: objectId,
        });
        return response.data;
      } else {
        console.error(
          "Error creating GenericObject:",
          error.response ? error.response.data : error.message
        );
        console.error("Full error:", error);
        throw error;
      }
    }
  }

  generateSaveUrl(classSuffix: any, objectSuffix: any): any {
    const claims = {
      iss: this.credentials.client_email,
      aud: "google",
      typ: "savetowallet",
      origins: ["your.website.com"],
      payload: {
        genericObjects: [
          {
            id: `${this.issuerId}.${objectSuffix}`,
            classId: `${this.issuerId}.${classSuffix}`,
          },
        ],
      },
    };

    const token = jwt.sign(claims, this.credentials.private_key, {
      algorithm: "RS256",
    });
    return `https://pay.google.com/gp/v/save/${token}`;
  }
}

export async function main() {
  try {
    const walletManager = new GoogleWalletManager();
    console.log("\n--- Google Wallet Manager ---");

    const classSuffix = "my_extracted_text_class";
    const objectSuffix = `text_entry_${uuidv4().replace(/-/g, "")}`;

    // 1. Create the Generic Pass Class (if it doesn't exist)
    await walletManager.createGenericClass(classSuffix);

    // 2. Simulate extracting text with proper validation
    const extractedText = {
      cardTitle: "SuperMart Receipt",
      primaryText: `Items Purchased:
        - Milk (2 units): ₹50
        - Bread (1 unit): ₹30
        - Eggs (12 units): ₹120
        
        Total: ₹200`,
      detailText: `Store: SuperMart
        Date: 2025-07-20
        Transaction ID: TXN-${uuidv4().slice(0, 8).toUpperCase()}`,
    };

    // 3. Create a Generic Pass Object with the extracted text
    await walletManager.createGenericObject(
      classSuffix,
      objectSuffix,
      extractedText
    );

    // 4. Generate the "Save to Google Wallet" URL
    const saveUrl = walletManager.generateSaveUrl(classSuffix, objectSuffix);
    console.log("\n--- Save to Google Wallet URL ---");
    console.log("Open this URL in your browser to save the pass:");
    console.log(saveUrl);
    console.log(
      "\nNote: You must be signed into a Google account that has access to your Issuer ID for demo purposes."
    );
  } catch (error) {
    console.error("An error occurred:", error);
  }
}
