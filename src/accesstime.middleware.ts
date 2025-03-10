import { Inject, Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { AccessTime } from "@accesstimeio/accesstime-sdk";
import { recoverMessageAddress, Hash } from "viem";
import { UnauthorizedException } from "@nestjs/common";

@Injectable()
export class AccessTimeMiddleware implements NestMiddleware {
    constructor(
        private readonly accessTimeClient: AccessTime,
        @Inject("ACCESSTIME_OPTIONS")
        private readonly options: {
            // Time in seconds that a user's subscription must be valid for
            minRemainingTime?: number;
        } = {}
    ) {}

    async use(req: Request, res: Response, next: NextFunction) {
        try {
            // Extract required signature data from request headers
            const walletSignature = req.headers["X-ACCESSTIME-AUTH-SIGNATURE"] as Hash;
            const messageHash = req.headers["X-ACCESSTIME-AUTH-MESSAGE"] as Hash;

            if (!walletSignature || !messageHash) {
                throw new UnauthorizedException("Missing wallet signature or message hash");
            }

            // Verify the message and recover signer address
            const signerAddress = await recoverMessageAddress({
                message: messageHash,
                signature: walletSignature
            });

            if (!signerAddress) {
                throw new UnauthorizedException("Invalid signature");
            }

            // Get user's remaining subscription time using the SDK's read function
            // Based on the ABI, we need to use the accessTimes function
            const userAccessTime = await this.accessTimeClient.read.accessTimes([signerAddress]);

            // Calculate remaining time (in seconds)
            const currentTimestamp = Math.floor(Date.now() / 1000);
            const remainingTime = Number(userAccessTime) - currentTimestamp;

            // Check if user has enough time remaining
            const minTime = this.options.minRemainingTime || 0;
            if (remainingTime < minTime) {
                throw new UnauthorizedException(
                    `Insufficient subscription time. Required: ${minTime}s, Remaining: ${remainingTime}s`
                );
            }

            // Attach user data to request for controllers to use
            req["accessTime"] = {
                signerAddress,
                accessTimeExpiry: Number(userAccessTime),
                remainingTime,
                verifiedAt: new Date()
            };

            next();
        } catch (error) {
            if (error instanceof UnauthorizedException) {
                return res.status(401).json({
                    statusCode: 401,
                    message: error.message,
                    error: "Unauthorized"
                });
            }

            return res.status(500).json({
                statusCode: 500,
                message: "Internal server error",
                error: error
            });
        }
    }
}
