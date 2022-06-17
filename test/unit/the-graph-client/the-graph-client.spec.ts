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

  describe('Checks for name ownership', function () {
    it('When no block for current timestamp, it should continue and check the block from 5 minute before', async () => {
      const externalCalls = buildExternalCalls({
        queryGraph: mockedQueryGraph().mockImplementation(
          async (url, _query, _variables) => {
            if (url.includes('marketplace')) {
              if (_variables['block'] === 123400) {
                return Promise.resolve({
                  names: [
                    {
                      name: 'Some Name'
                    }
                  ]
                })
              }
            } else if (url.includes('blocks')) {
              return Promise.resolve({
                min: [{ number: 123400 }],
                max: []
              })
            }
          }
        )
      })
      const { theGraphClient } = buildComponents({ externalCalls })

      await expect(
        theGraphClient.checkForNamesOwnershipWithTimestamp(
          '0x1',
          ['Some Name'],
          10
        )
      ).resolves.toEqual({ result: true })
    })

    it('When current block has not been indexed yet, it should continue and check the block from 5 minute before', async () => {
      const externalCalls = buildExternalCalls({
        queryGraph: mockedQueryGraph().mockImplementation(
          async (url, _query, _variables) => {
            if (url.includes('marketplace')) {
              if (_variables['block'] === 123500) {
                return Promise.reject('error')
              } else
                return Promise.resolve({
                  names: [
                    {
                      name: 'Some Name'
                    }
                  ]
                })
            } else if (url.includes('blocks')) {
              return Promise.resolve({
                min: [{ number: 123400 }],
                max: [{ number: 123500 }]
              })
            }
          }
        )
      })
      const { theGraphClient } = buildComponents({ externalCalls })

      await expect(
        theGraphClient.checkForNamesOwnershipWithTimestamp(
          '0x1',
          ['Some Name'],
          10
        )
      ).resolves.toEqual({ result: true })
    })

    it('When both current and 5-min before blocks have not been indexed yet, it should report error', async () => {
      const externalCalls = buildExternalCalls({
        queryGraph: mockedQueryGraph().mockImplementation(
          async (url, _query, _variables) => {
            if (url.includes('marketplace')) {
              return Promise.reject('error')
            } else if (url.includes('blocks')) {
              return Promise.resolve({
                min: [{ number: 123400 }],
                max: [{ number: 123500 }]
              })
            }
          }
        )
      })
      const { theGraphClient } = buildComponents({ externalCalls })

      await expect(
        theGraphClient.checkForNamesOwnershipWithTimestamp(
          '0x1',
          ['Some Name'],
          10
        )
      ).resolves.toEqual({ result: false })
    })
  })

  describe('Checks for wearables ownership', function () {
    it('When no block for current timestamp, it should continue and check the block from 5 minute before', async () => {
      const externalCalls = buildExternalCalls({
        queryGraph: mockedQueryGraph().mockImplementation(
          async (url, _query, _variables) => {
            if (url.includes('blocks')) {
              return Promise.resolve({
                min: [{ number: 123400 }],
                max: []
              })
            } else if (url.includes('ethereum')) {
              return Promise.resolve({
                wearables: [
                  {
                    urn: 'urn:decentraland:ethereum:collections-v1:rtfkt_x_atari:p_rtfkt_x_atari_feet'
                  }
                ]
              })
            } else if (url.includes('matic')) {
              return Promise.resolve({
                wearables: [
                  {
                    urn: 'urn:decentraland:matic:collections-v2:0x04e7f74e73e951c61edd80910e46c3fece5ebe80:2'
                  }
                ]
              })
            }
          }
        )
      })
      const { theGraphClient } = buildComponents({ externalCalls })

      await expect(
        theGraphClient.checkForWearablesOwnershipWithTimestamp(
          '0x1',
          [
            'urn:decentraland:ethereum:collections-v1:rtfkt_x_atari:p_rtfkt_x_atari_feet',
            'urn:decentraland:matic:collections-v2:0x04e7f74e73e951c61edd80910e46c3fece5ebe80:2'
          ],
          10
        )
      ).resolves.toEqual({ result: true })
    })

    it('When current block has not been indexed yet, it should continue and check the block from 5 minute before', async () => {
      const externalCalls = buildExternalCalls({
        queryGraph: mockedQueryGraph().mockImplementation(
          async (url, _query, _variables) => {
            if (url.includes('blocks')) {
              return Promise.resolve({
                min: [{ number: 123400 }],
                max: [{ number: 123500 }]
              })
            } else if (url.includes('ethereum')) {
              if (_variables['block'] === 123500) {
                return Promise.reject('error')
              } else
                return Promise.resolve({
                  wearables: [
                    {
                      urn: 'urn:decentraland:ethereum:collections-v1:rtfkt_x_atari:p_rtfkt_x_atari_feet'
                    }
                  ]
                })
            } else if (url.includes('matic')) {
              return Promise.resolve({
                wearables: [
                  {
                    urn: 'urn:decentraland:matic:collections-v2:0x04e7f74e73e951c61edd80910e46c3fece5ebe80:2'
                  }
                ]
              })
            }
          }
        )
      })
      const { theGraphClient } = buildComponents({ externalCalls })

      await expect(
        theGraphClient.checkForWearablesOwnershipWithTimestamp(
          '0x1',
          [
            'urn:decentraland:ethereum:collections-v1:rtfkt_x_atari:p_rtfkt_x_atari_feet',
            'urn:decentraland:matic:collections-v2:0x04e7f74e73e951c61edd80910e46c3fece5ebe80:2'
          ],
          10
        )
      ).resolves.toEqual({ result: true })
    })

    it('When both current and 5-min before blocks have not been indexed yet, it should report error', async () => {
      const externalCalls = buildExternalCalls({
        queryGraph: mockedQueryGraph().mockImplementation(
          async (url, _query, _variables) => {
            if (url.includes('marketplace')) {
              return Promise.reject('error')
            } else if (url.includes('blocks')) {
              return Promise.resolve({
                min: [{ number: 123400 }],
                max: [{ number: 123500 }]
              })
            }
          }
        )
      })
      const { theGraphClient } = buildComponents({ externalCalls })

      await expect(
        theGraphClient.checkForWearablesOwnershipWithTimestamp(
          '0x1',
          [
            'urn:decentraland:ethereum:collections-v1:rtfkt_x_atari:p_rtfkt_x_atari_feet',
            'urn:decentraland:matic:collections-v2:0x04e7f74e73e951c61edd80910e46c3fece5ebe80:2'
          ],
          10
        )
      ).resolves.toEqual({ result: false, failing: [] })
    })
  })
})
