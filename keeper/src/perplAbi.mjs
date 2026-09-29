// Extracted from the Perpl web app bundle (exchange contract, v1.7.5). Only the read functions we use.
export const perplExchangeAbi = [
  {
    "type": "function",
    "inputs": [
      {
        "name": "accountAddress",
        "internalType": "address",
        "type": "address"
      }
    ],
    "name": "getAccountByAddr",
    "outputs": [
      {
        "name": "accountInfo",
        "internalType": "struct AccountInfo",
        "type": "tuple",
        "components": [
          {
            "name": "accountId",
            "internalType": "uint256",
            "type": "uint256"
          },
          {
            "name": "balanceCNS",
            "internalType": "uint256",
            "type": "uint256"
          },
          {
            "name": "lockedBalanceCNS",
            "internalType": "uint256",
            "type": "uint256"
          },
          {
            "name": "frozen",
            "internalType": "enum FreezeStatusEnum",
            "type": "uint8"
          },
          {
            "name": "accountAddr",
            "internalType": "address",
            "type": "address"
          },
          {
            "name": "positions",
            "internalType": "struct PositionBitMap",
            "type": "tuple",
            "components": [
              {
                "name": "bank1",
                "internalType": "uint256",
                "type": "uint256"
              },
              {
                "name": "bank2",
                "internalType": "uint256",
                "type": "uint256"
              },
              {
                "name": "bank3",
                "internalType": "uint256",
                "type": "uint256"
              },
              {
                "name": "bank4",
                "internalType": "uint256",
                "type": "uint256"
              }
            ]
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "inputs": [
      {
        "name": "perpId",
        "internalType": "uint256",
        "type": "uint256"
      },
      {
        "name": "accountId",
        "internalType": "uint256",
        "type": "uint256"
      }
    ],
    "name": "getPosition",
    "outputs": [
      {
        "name": "positionInfo",
        "internalType": "struct PositionInfo",
        "type": "tuple",
        "components": [
          {
            "name": "accountId",
            "internalType": "uint256",
            "type": "uint256"
          },
          {
            "name": "nextNodeId",
            "internalType": "uint256",
            "type": "uint256"
          },
          {
            "name": "prevNodeId",
            "internalType": "uint256",
            "type": "uint256"
          },
          {
            "name": "positionType",
            "internalType": "enum PositionEnum",
            "type": "uint8"
          },
          {
            "name": "depositCNS",
            "internalType": "uint256",
            "type": "uint256"
          },
          {
            "name": "pricePNS",
            "internalType": "uint256",
            "type": "uint256"
          },
          {
            "name": "lotLNS",
            "internalType": "uint256",
            "type": "uint256"
          },
          {
            "name": "entryBlock",
            "internalType": "uint256",
            "type": "uint256"
          },
          {
            "name": "pnlCNS",
            "internalType": "int256",
            "type": "int256"
          },
          {
            "name": "deltaPnlCNS",
            "internalType": "int256",
            "type": "int256"
          },
          {
            "name": "premiumPnlCNS",
            "internalType": "int256",
            "type": "int256"
          }
        ]
      },
      {
        "name": "markPricePNS",
        "internalType": "uint256",
        "type": "uint256"
      },
      {
        "name": "markPriceValid",
        "internalType": "bool",
        "type": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "inputs": [
      {
        "name": "perpId",
        "internalType": "uint256",
        "type": "uint256"
      }
    ],
    "name": "getPerpetualInfo",
    "outputs": [
      {
        "name": "perpetualInfo",
        "internalType": "struct PerpetualInfo",
        "type": "tuple",
        "components": [
          {
            "name": "name",
            "internalType": "string",
            "type": "string"
          },
          {
            "name": "symbol",
            "internalType": "string",
            "type": "string"
          },
          {
            "name": "priceDecimals",
            "internalType": "uint256",
            "type": "uint256"
          },
          {
            "name": "lotDecimals",
            "internalType": "uint256",
            "type": "uint256"
          },
          {
            "name": "linkFeedId",
            "internalType": "bytes32",
            "type": "bytes32"
          },
          {
            "name": "priceTolPer100K",
            "internalType": "uint256",
            "type": "uint256"
          },
          {
            "name": "marginTol",
            "internalType": "uint256",
            "type": "uint256"
          },
          {
            "name": "marginTolDecimals",
            "internalType": "uint256",
            "type": "uint256"
          },
          {
            "name": "refPriceMaxAgeSec",
            "internalType": "uint256",
            "type": "uint256"
          },
          {
            "name": "positionBalanceCNS",
            "internalType": "uint256",
            "type": "uint256"
          },
          {
            "name": "insuranceBalanceCNS",
            "internalType": "uint256",
            "type": "uint256"
          },
          {
            "name": "markPNS",
            "internalType": "uint256",
            "type": "uint256"
          },
          {
            "name": "markTimestamp",
            "internalType": "uint256",
            "type": "uint256"
          },
          {
            "name": "lastPNS",
            "internalType": "uint256",
            "type": "uint256"
          },
          {
            "name": "lastTimestamp",
            "internalType": "uint256",
            "type": "uint256"
          },
          {
            "name": "oraclePNS",
            "internalType": "uint256",
            "type": "uint256"
          },
          {
            "name": "oracleTimestampSec",
            "internalType": "uint256",
            "type": "uint256"
          },
          {
            "name": "longOpenInterestLNS",
            "internalType": "uint256",
            "type": "uint256"
          },
          {
            "name": "shortOpenInterestLNS",
            "internalType": "uint256",
            "type": "uint256"
          },
          {
            "name": "fundingStartBlock",
            "internalType": "uint256",
            "type": "uint256"
          },
          {
            "name": "fundingRatePct100k",
            "internalType": "int16",
            "type": "int16"
          },
          {
            "name": "absFundingClampPctPer100K",
            "internalType": "uint256",
            "type": "uint256"
          },
          {
            "name": "status",
            "internalType": "enum PerpStatusEnum",
            "type": "uint8"
          },
          {
            "name": "basePricePNS",
            "internalType": "uint256",
            "type": "uint256"
          },
          {
            "name": "maxBidPriceONS",
            "internalType": "uint256",
            "type": "uint256"
          },
          {
            "name": "minBidPriceONS",
            "internalType": "uint256",
            "type": "uint256"
          },
          {
            "name": "maxAskPriceONS",
            "internalType": "uint256",
            "type": "uint256"
          },
          {
            "name": "minAskPriceONS",
            "internalType": "uint256",
            "type": "uint256"
          },
          {
            "name": "numOrders",
            "internalType": "uint256",
            "type": "uint256"
          },
          {
            "name": "ignOracle",
            "internalType": "bool",
            "type": "bool"
          }
        ]
      }
    ],
    "stateMutability": "view"
  }
];
