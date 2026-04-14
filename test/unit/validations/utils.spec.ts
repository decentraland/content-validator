import { safeParseUrn } from '../../../src/utils'

describe('safeParseUrn', () => {
  it('should return the parsed result for a valid URN', async () => {
    const urn = 'urn:decentraland:matic:collections-v2:0xf6f601efee04e74cecac02c8c5bdc8cc0fc1c721:0'
    const result = await safeParseUrn(urn)
    expect(result).toBeDefined()
    expect(result?.type).toBe('blockchain-collection-v2-asset')
  })

  it('should return null for an unresolvable URN', async () => {
    const result = await safeParseUrn('urn:decentraland:invalid')
    expect(result).toBeNull()
  })

  it('should return null instead of throwing for a malformed input', async () => {
    const result = await safeParseUrn('')
    expect(result).toBeNull()
  })
})
