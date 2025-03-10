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
                provide: "ACCESSTIME_OPTIONS",
                useValue: {
                    minRemainingTime: options.minRemainingTime ?? 0
                }
            },
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
                useFactory: (
                    accessTimeClient: AccessTime,
                    options: {
                        minRemainingTime?: number;
                    }
                ) => {
                    return new AccessTimeMiddleware(accessTimeClient, options);
                },
                inject: [AccessTime, "ACCESSTIME_OPTIONS"]
            }
        ];

        return {
            module: AccessTimeModule,
            providers,
            exports: [AccessTimeMiddleware, AccessTime, "ACCESSTIME_OPTIONS"]
        };
    }
}
