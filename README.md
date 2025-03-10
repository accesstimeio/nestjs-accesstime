# NestJS AccessTime Middleware

A NestJS middleware package for integrating with AccessTime subscription payment service.

## Features

- Verify wallet signatures for incoming requests
- Check user subscription time using the official AccessTime SDK
- Protect your routes with middleware or guards
- Easy integration with NestJS applications

## Installation

```bash
npm install nestjs-accesstime
```

## Usage

### Module Registration

First, import and register the AccessTimeModule in your application:

```typescript
import { Module } from '@nestjs/common';
import { AccessTimeModule } from 'nestjs-accesstime';

@Module({
  imports: [
    AccessTimeModule.register({
      chain: {
        id: 8453,
        rpcUrl: 'https://mainnet.base.org', // optional
      },
      contractAddress: '0xYourAccessTimeContractAddress',
      minRemainingTime: 3600, // 1 hour in seconds, optional
    }),
  ],
})
export class AppModule {}
```

### Using the Middleware

Apply the middleware to your routes:

```typescript
import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { AccessTimeMiddleware } from 'nestjs-accesstime';

@Module({
  // ...
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply middleware to all routes
    consumer
      .apply(AccessTimeMiddleware)
      .forRoutes('*');
    
    // Or apply to specific routes
    consumer
      .apply(AccessTimeMiddleware)
      .forRoutes('protected');
  }
}
```

### Using the Guard

Alternatively, you can use the guard to protect specific routes:

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AccessTimeGuard } from 'nestjs-accesstime';

@Controller('protected')
export class ProtectedController {
  @Get()
  @UseGuards(AccessTimeGuard)
  getProtectedResource() {
    return { message: 'This is a protected resource' };
  }
}
```

### Using the AccessTime Client

You can inject and use the AccessTime client directly in your services:

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { AccessTime } from 'nestjs-accesstime';

@Injectable()
export class SubscriptionService {
  constructor(
    @Inject(AccessTime) private readonly accessTimeClient: AccessTime
  ) {}
  
  async getUserAccessTime(userAddress: string): Promise<number> {
    const accessTime = await this.accessTimeClient.read.accessTimes([userAddress]);
    return Number(accessTime);
  }
  
  async getPackageDetails(packageId: number): Promise<any> {
    const packageDetails = await this.accessTimeClient.read.packages([BigInt(packageId)]);
    return {
      time: Number(packageDetails[0]),
      exists: packageDetails[1]
    };
  }
}
```

### Client-Side Implementation

Your client needs to send requests with the required headers:

```typescript
import { signMessage, hashMessage } from 'viem';

const message = 'Authenticate for AccessTime: ' + Date.now(); // Include timestamp to prevent replay attacks
const signature = await signMessage({
  message,
  account: walletAddress,
});

// Then add these headers to your request
const headers = {
  'X-ACCESSTIME-AUTH-SIGNATURE': signature,
  'X-ACCESSTIME-AUTH-MESSAGE': hashMessage(message),
};

// Make the request with these headers
fetch('https://your-api.com/protected-route', {
  headers,
});
```

## Configuration Options

The `AccessTimeModule.register()` method accepts the following options:

| Option | Type | Description |
|--------|------|-------------|
| chain.id | number | Chain ID (supported by AccessTime) |
| chain.rpcUrl | string | (Optional) RPC URL for the chain |
| contractAddress | string | AccessTime contract address |
| minRemainingTime | number | (Optional) Minimum time in seconds a user must have remaining |
| accessTimeClient | AccessTime | (Optional) Custom AccessTime client instance |

## Accessing User Data

The middleware adds user data to the request object, which you can access in your controllers:

```typescript
import { Controller, Get, Req } from '@nestjs/common';
import { Request } from 'express';

@Controller('user')
export class UserController {
  @Get('subscription')
  getSubscriptionInfo(@Req() request: Request) {
    const accessTimeData = request['accessTime'];
    
    return {
      address: accessTimeData.signerAddress,
      expiryTimestamp: accessTimeData.accessTimeExpiry,
      remainingTime: accessTimeData.remainingTime,
      expiresAt: new Date(accessTimeData.accessTimeExpiry * 1000).toISOString(),
    };
  }
}
```

## License

MIT
