import { Module, DynamicModule, Provider } from "@nestjs/common";
import { AccessTime } from "@accesstimeio/accesstime-sdk";
import { Address } from "viem";

import { AccessTimeMiddleware } from "./accesstime.middleware";

export interface AccessTimeModuleOptions {
    // Chain configuration
    chain: {
        id: number;
        rpcUrl?: string;
    };
    // AccessTime contract address
    contractAddress: Address;
    // Minimum remaining time required (in seconds)
    minRemainingTime?: number;
    // Optional: provide a custom AccessTime instance
    accessTimeClient?: AccessTime;
}

@Module({})
export class AccessTimeModule {
    static register(options: AccessTimeModuleOptions): DynamicModule {
        const providers: Provider[] = [
            {
                provide: AccessTime,
                useFactory: () => {
                    if (options.accessTimeClient) {
                        return options.accessTimeClient;
                    }

                    return new AccessTime({
                        chain: {
                            id: options.chain.id,
                            rpcUrl: options.chain.rpcUrl
                        },
                        accessTime: options.contractAddress
                    });
                }
            },
            {
                provide: AccessTimeMiddleware,
                useFactory: (accessTimeClient: AccessTime) => {
                    return new AccessTimeMiddleware(accessTimeClient, {
                        minRemainingTime: options.minRemainingTime
                    });
                },
                inject: [AccessTime]
            }
        ];

        return {
            module: AccessTimeModule,
            providers,
            exports: [AccessTimeMiddleware, AccessTime]
        };
    }
}
