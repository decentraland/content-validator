import { OK } from '../../../src/types'

describe('when using the OK validation response constant', () => {
  it('should be frozen to prevent accidental mutation', () => {
    expect(Object.isFrozen(OK)).toBe(true)
  })

  it('should have ok set to true', () => {
    expect(OK.ok).toBe(true)
  })
})
