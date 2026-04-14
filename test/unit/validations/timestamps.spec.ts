describe('parseTimestamp', () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...ORIGINAL_ENV }
  })

  afterAll(() => {
    process.env = ORIGINAL_ENV
  })

  it('should use the default value when env var is not set', async () => {
    delete process.env.ADR_45_TIMESTAMP
    const { ADR_45_TIMESTAMP } = await import('../../../src/validations/timestamps')
    expect(ADR_45_TIMESTAMP).toBe(1652191200000)
  })

  it('should use the env var value when it is a valid number', async () => {
    process.env.ADR_45_TIMESTAMP = '9999999999999'
    const { ADR_45_TIMESTAMP } = await import('../../../src/validations/timestamps')
    expect(ADR_45_TIMESTAMP).toBe(9999999999999)
  })

  it('should fall back to default when env var is not a valid number', async () => {
    process.env.ADR_45_TIMESTAMP = 'invalid'
    const { ADR_45_TIMESTAMP } = await import('../../../src/validations/timestamps')
    expect(ADR_45_TIMESTAMP).toBe(1652191200000)
  })

  it('should fall back to default when env var is an empty string', async () => {
    process.env.ADR_45_TIMESTAMP = ''
    const { ADR_45_TIMESTAMP } = await import('../../../src/validations/timestamps')
    expect(ADR_45_TIMESTAMP).toBe(1652191200000)
  })
})
