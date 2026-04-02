import cors from "cors";

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:4000",
  "http://localhost:5173",
  "http://10.8.200.14:4000",
];

export const corsConfig = cors({
  origin: (origin, callback) => {
    // Permite requests sem origin (same-origin, curl, etc)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Em dev, permite todas as origens
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  credentials: true,
});
