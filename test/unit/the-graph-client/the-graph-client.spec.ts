import {
  buildComponents,
  buildExternalCalls,
  fetcherWithWearablesOwnership,
  mockedQueryGraph
} from '../../setup/mock'

describe('TheGraphClient', () => {
  it('When invocation to TheGraph throws an error, it is reported accordingly', async () => {
    const externalCalls = buildExternalCalls({
      queryGraph: mockedQueryGraph().mockRejectedValue('error')
    })

    const { theGraphClient } = buildComponents({ externalCalls })

    await expect(
      theGraphClient.checkForNamesOwnershipWithTimestamp(
        '0x1',
        ['Some Name'],
        10
      )
    ).rejects.toThrow('Internal server error')
  })

  it('When invoking findBlocksForTimestamp, it may happen that no block matches and exception is thrown', async () => {
    const externalCalls = buildExternalCalls({
      queryGraph: fetcherWithWearablesOwnership(
        '0x862f109696d7121438642a78b3caa38f476db08b',
        undefined,
        undefined,
        undefined,
        {
          max: [],
          min: []
        }
      )
    })

    const { theGraphClient } = buildComponents({ externalCalls })

    await expect(
      theGraphClient.findBlocksForTimestamp('blocksSubgraph', 10)
    ).rejects.toThrow('Internal server error')
  })
})
