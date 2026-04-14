import { safeParseUrn } from '../../../src/utils'

describe('when parsing a URN with safeParseUrn', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('and the URN is valid', () => {
    let result: Awaited<ReturnType<typeof safeParseUrn>>

    beforeEach(async () => {
      result = await safeParseUrn('urn:decentraland:matic:collections-v2:0xf6f601efee04e74cecac02c8c5bdc8cc0fc1c721:0')
    })

    it('should return the parsed result', () => {
      expect(result).toBeDefined()
      expect(result?.type).toBe('blockchain-collection-v2-asset')
    })
  })

  describe('and the URN is unresolvable', () => {
    let result: Awaited<ReturnType<typeof safeParseUrn>>

    beforeEach(async () => {
      result = await safeParseUrn('urn:decentraland:invalid')
    })

    it('should return null', () => {
      expect(result).toBeNull()
    })
  })

  describe('and the input is malformed', () => {
    let result: Awaited<ReturnType<typeof safeParseUrn>>

    beforeEach(async () => {
      result = await safeParseUrn('')
    })

    it('should return null instead of throwing', () => {
      expect(result).toBeNull()
    })
  })
})
