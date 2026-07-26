# Billing Models

| Model | Description | requiresMemory | Invoice template |
|---|---|---|---|
| billing-free | Operates without charging the end user. | No | No |
| billing-subscription | Manages recurring subscription billing and plan tiers. | Yes | Yes |
| billing-usage | Meters and bills based on measured usage volume. | Yes | Yes |
| billing-credit | Manages a prepaid credit balance and deducts usage from it. | Yes | Yes |
| billing-token | Bills using a fungible token on a configured blockchain network. | No | No |
| billing-nft | Gates access or features based on NFT ownership. | No | No |
| billing-enterprise | Supports custom contract terms and invoiced billing cycles. | Yes | Yes |
| billing-hybrid | Combines multiple billing models for a single agent. | Yes | Yes |
