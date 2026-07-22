import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { customerAuth } from "../lib/customer-auth";

type CustomerSession = NonNullable<Awaited<ReturnType<typeof customerAuth.api.getSession>>>;

declare global {
  namespace Express {
    interface Request {
      customer: CustomerSession["user"];
      customerSession: CustomerSession["session"];
    }
  }
}

export async function requireCustomerAuth(req: Request, res: Response, next: NextFunction) {
  const result = await customerAuth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!result) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.customer = result.user;
  req.customerSession = result.session;
  next();
}
