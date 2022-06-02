import {
  buildComponents,
  buildExternalCalls,
  mockedQueryGraph
} from '../../setup/mock'

describe('TheGraphClient', () => {
  it('When invocation to TheGraph throws an error, it is reported accordingly', async () => {
    const externalCalls = buildExternalCalls({
      queryGraph: mockedQueryGraph().mockRejectedValue('error')
    })

    const { theGraphClient } = buildComponents({ externalCalls })

    await expect(
      theGraphClient.findOwnersByName(['Some Name'])
    ).rejects.toThrow('Internal server error')
  })
})
