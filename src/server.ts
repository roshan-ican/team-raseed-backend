import app from "./app";
import dotenv from "dotenv";


dotenv.config();

const start = async () => {
  try {
    app.listen({ port: parseInt(process.env.PORT || "3000"), host: "0.0.0.0" });
    console.log(`Server running on http://localhost:${process.env.PORT}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
