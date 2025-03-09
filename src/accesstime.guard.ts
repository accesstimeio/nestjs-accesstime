import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { AccessTime } from "@accesstimeio/accesstime-sdk";
import { recoverMessageAddress, Hash } from "viem";
import { Request } from "express";

@Injectable()
export class AccessTimeGuard implements CanActivate {
    constructor(
        private readonly accessTimeClient: AccessTime,
        private readonly options: {
            minRemainingTime?: number;
        } = {}
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<Request>();

        // Extract required signature data from request headers
        const walletSignature = request.headers["x-wallet-signature"] as Hash;
        const messageHash = request.headers["x-message-hash"] as Hash;

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
        request["accessTime"] = {
            signerAddress,
            accessTimeExpiry: Number(userAccessTime),
            remainingTime,
            verifiedAt: new Date()
        };

        return true;
    }
}
