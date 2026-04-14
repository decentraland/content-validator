describe('when parsing timestamp environment variables', () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...ORIGINAL_ENV }
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  describe('and the env var is not set', () => {
    beforeEach(() => {
      delete process.env.ADR_45_TIMESTAMP
    })

    it('should use the default value', async () => {
      const { ADR_45_TIMESTAMP } = await import('../../../src/validations/timestamps')
      expect(ADR_45_TIMESTAMP).toBe(1652191200000)
    })
  })

  describe('and the env var is a valid number', () => {
    beforeEach(() => {
      process.env.ADR_45_TIMESTAMP = '9999999999999'
    })

    it('should use the parsed value', async () => {
      const { ADR_45_TIMESTAMP } = await import('../../../src/validations/timestamps')
      expect(ADR_45_TIMESTAMP).toBe(9999999999999)
    })
  })

  describe('and the env var is not a valid number', () => {
    beforeEach(() => {
      process.env.ADR_45_TIMESTAMP = 'invalid'
    })

    it('should fall back to the default value', async () => {
      const { ADR_45_TIMESTAMP } = await import('../../../src/validations/timestamps')
      expect(ADR_45_TIMESTAMP).toBe(1652191200000)
    })
  })

  describe('and the env var is an empty string', () => {
    beforeEach(() => {
      process.env.ADR_45_TIMESTAMP = ''
    })

    it('should fall back to the default value', async () => {
      const { ADR_45_TIMESTAMP } = await import('../../../src/validations/timestamps')
      expect(ADR_45_TIMESTAMP).toBe(1652191200000)
    })
  })
})
