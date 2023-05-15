import { Outfits } from '@dcl/schemas'

export const VALID_OUTFITS_METADATA: Outfits = {
  outfits: [
    {
      slot: 1,
      outfit: {
        bodyShape: 'urn:decentraland:off-chain:base-avatars:BaseMale',
        eyes: { color: { r: 0.23046875, g: 0.625, b: 0.3125 } },
        hair: { color: { r: 0.35546875, g: 0.19140625, b: 0.05859375 } },
        skin: { color: { r: 0.94921875, g: 0.76171875, b: 0.6484375 } },
        wearables: [
          'urn:decentraland:off-chain:base-avatars:tall_front_01',
          'urn:decentraland:off-chain:base-avatars:eyes_08',
          'urn:decentraland:off-chain:base-avatars:eyebrows_00',
          'urn:decentraland:off-chain:base-avatars:mouth_05',
          'urn:decentraland:matic:collections-v2:0xf6f601efee04e74cecac02c8c5bdc8cc0fc1c721:0',
          'urn:decentraland:off-chain:base-avatars:classic_shoes',
          'urn:decentraland:off-chain:base-avatars:red_tshirt',
          'urn:decentraland:matic:collections-v2:0x04e7f74e73e951c61edd80910e46c3fece5ebe80:2',
          'urn:decentraland:ethereum:collections-v1:rtfkt_x_atari:p_rtfkt_x_atari_feet',
          'urn:decentraland:matic:collections-v2:0xf1483f042614105cb943d3dd67157256cd003028:2',
          'urn:decentraland:matic:collections-v2:0xf1483f042614105cb943d3dd67157256cd003028:19',
          'urn:decentraland:matic:collections-v2:0xa7f6eba61566fd4b3012569ef30f0200ec138aa4:0'
        ]
      }
    }
  ],
  namesForExtraSlots: []
}
