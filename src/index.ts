import express from "express";
import routes from "./routes";
import cookieParser from "cookie-parser";
import { createServer } from "node:http";


const port = process.env.PORT || 3000;

const app = express();
const server = createServer(app);

app.use(express.json());
app.use(cookieParser());

//cors stuff
const allowedOrigins = ['http://localhost:5173', 'https://www.oidelta.com', 'https://oidelta.com']; // Define your allowed origins
app.use((req, res, next) => {
  const origin = req.headers.origin; // Get the origin of the incoming request
  
  // Check if the request's origin is in the list of allowed origins
  if (allowedOrigins.includes(origin)) {
    // console.log("origin matches",req.body);
    res.header("Access-Control-Allow-Origin", origin); // Set the Access-Control-Allow-Origin to the incoming origin
  }
  
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, userId, agentid, adminid, skey"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS"); // Specify allowed methods
  res.header("Access-Control-Allow-Credentials", "true"); // Allow credentials (cookies)
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200); // Quickly respond to preflight checks
  }

  next();
});


app.listen(port, () => {
  console.log(`App is running at http://localhost:${port}`);
  routes(app);
});