import { buildComponents, buildSubGraphs, createMockSubgraphComponent } from '../../setup/mock'

describe.skip('TheGraphClient', () => {
  it('When invocation to TheGraph throws an error, it is reported accordingly', async () => {
    const subGraphs = buildSubGraphs({
      L1: {
        collections: createMockSubgraphComponent(),
        blocks: createMockSubgraphComponent(
          jest.fn().mockImplementation(() => {
            throw new Error('error')
          })
        ),
        landManager: createMockSubgraphComponent(),
        ensOwner: createMockSubgraphComponent()
      }
    })

    const { theGraphClient } = buildComponents({ subGraphs })

    await expect(theGraphClient.ownsNamesAtTimestamp('0x1', ['Some Name'], 10)).rejects.toThrow('error')
  })

  it('When invoking findBlocksForTimestamp, it may happen that no block matches and exception is thrown', async () => {
    const subGraphs = buildSubGraphs({
      L1: {
        collections: createMockSubgraphComponent(),
        blocks: createMockSubgraphComponent(
          jest.fn().mockResolvedValueOnce({
            max: [],
            min: []
          })
        ),
        landManager: createMockSubgraphComponent(),
        ensOwner: createMockSubgraphComponent()
      }
    })

    const { theGraphClient } = buildComponents({ subGraphs })

    await expect(
      theGraphClient.findBlocksForTimestamp(subGraphs.L1.blocks, 10, subGraphs.l1BlockSearch)
    ).rejects.toThrow('Failed to find blocks for the specific timestamp')
  })

  describe('Checks for name ownership', function () {
    it('When no block for current timestamp, it should continue and check the block from 5 minute before', async () => {
      const subGraphs = buildSubGraphs({
        L1: {
          collections: createMockSubgraphComponent(),
          blocks: createMockSubgraphComponent(
            jest.fn().mockResolvedValueOnce({
              min: [{ number: 123400 }],
              max: []
            })
          ),
          landManager: createMockSubgraphComponent(),
          ensOwner: createMockSubgraphComponent(
            jest.fn().mockImplementation(async (_query, _variables) => {
              if (_variables['block'] === 123400) {
                return Promise.resolve({
                  names: [
                    {
                      name: 'Some Name'
                    }
                  ]
                })
              }
            })
          )
        }
      })
      const { theGraphClient } = buildComponents({ subGraphs })

      await expect(theGraphClient.ownsNamesAtTimestamp('0x1', ['Some Name'], 10)).resolves.toEqual({
        result: true
      })
    })

    it('When current block has not been indexed yet, it should continue and check the block from 5 minute before', async () => {
      const subGraphs = buildSubGraphs({
        L1: {
          collections: createMockSubgraphComponent(),
          blocks: createMockSubgraphComponent(
            jest.fn().mockResolvedValueOnce({
              min: [{ number: 123400 }],
              max: [{ number: 123500 }]
            })
          ),
          landManager: createMockSubgraphComponent(),
          ensOwner: createMockSubgraphComponent(
            jest.fn().mockImplementation(async (_query, _variables) => {
              if (_variables['block'] === 123500) {
                return Promise.reject('error')
              } else {
                return Promise.resolve({
                  names: [
                    {
                      name: 'Some Name'
                    }
                  ]
                })
              }
            })
          )
        }
      })
      const { theGraphClient } = buildComponents({ subGraphs })

      await expect(theGraphClient.ownsNamesAtTimestamp('0x1', ['Some Name'], 10)).resolves.toEqual({
        result: true
      })
    })

    it('When both current and 5-min before blocks have not been indexed yet, it should report error', async () => {
      const subGraphs = buildSubGraphs({
        L1: {
          collections: createMockSubgraphComponent(),
          blocks: createMockSubgraphComponent(
            jest.fn().mockResolvedValueOnce({
              min: [{ number: 123400 }],
              max: [{ number: 123500 }]
            })
          ),
          landManager: createMockSubgraphComponent(),
          ensOwner: createMockSubgraphComponent(jest.fn().mockRejectedValue('error'))
        }
      })
      const { theGraphClient } = buildComponents({ subGraphs })

      await expect(theGraphClient.ownsNamesAtTimestamp('0x1', ['Some Name'], 10)).resolves.toEqual({
        result: false
      })
    })
  })

  describe('Checks for wearables ownership', function () {
    it('When no block for current timestamp, it should continue and check the block from 5 minute before', async () => {
      const subGraphs = buildSubGraphs({
        L1: {
          collections: createMockSubgraphComponent(
            jest.fn().mockResolvedValue({
              items: [
                {
                  urn: 'urn:decentraland:ethereum:collections-v1:rtfkt_x_atari:p_rtfkt_x_atari_feet'
                }
              ]
            })
          ),
          blocks: createMockSubgraphComponent(
            jest.fn().mockResolvedValueOnce({
              min: [{ number: 123400 }],
              max: []
            })
          ),
          landManager: createMockSubgraphComponent(),
          ensOwner: createMockSubgraphComponent(jest.fn().mockRejectedValue('error'))
        },
        L2: {
          thirdPartyRegistry: createMockSubgraphComponent(),
          blocks: createMockSubgraphComponent(
            jest.fn().mockResolvedValueOnce({
              min: [{ number: 123400 }],
              max: []
            })
          ),
          collections: createMockSubgraphComponent(
            jest.fn().mockResolvedValue({
              items: [
                {
                  urn: 'urn:decentraland:matic:collections-v2:0x04e7f74e73e951c61edd80910e46c3fece5ebe80:2'
                }
              ]
            })
          )
        }
      })
      const { theGraphClient } = buildComponents({ subGraphs })

      await expect(
        theGraphClient.ownsItemsAtTimestamp(
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
      const subGraphs = buildSubGraphs({
        L1: {
          collections: createMockSubgraphComponent(
            jest.fn().mockImplementation(async (_query, _variables) => {
              if (_variables['block'] === 123500) {
                return Promise.reject('error')
              } else {
                return Promise.resolve({
                  items: [
                    {
                      urn: 'urn:decentraland:ethereum:collections-v1:rtfkt_x_atari:p_rtfkt_x_atari_feet'
                    }
                  ]
                })
              }
            })
          ),
          blocks: createMockSubgraphComponent(
            jest.fn().mockResolvedValueOnce({
              min: [{ number: 123400 }],
              max: [{ number: 123500 }]
            })
          ),
          landManager: createMockSubgraphComponent(),
          ensOwner: createMockSubgraphComponent()
        },
        L2: {
          thirdPartyRegistry: createMockSubgraphComponent(),
          blocks: createMockSubgraphComponent(
            jest.fn().mockResolvedValueOnce({
              min: [{ number: 123400 }],
              max: [{ number: 123500 }]
            })
          ),
          collections: createMockSubgraphComponent(
            jest.fn().mockResolvedValue({
              items: [
                {
                  urn: 'urn:decentraland:matic:collections-v2:0x04e7f74e73e951c61edd80910e46c3fece5ebe80:2'
                }
              ]
            })
          )
        }
      })
      const { theGraphClient } = buildComponents({ subGraphs })

      await expect(
        theGraphClient.ownsItemsAtTimestamp(
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
      const subGraphs = buildSubGraphs({
        L1: {
          collections: createMockSubgraphComponent(
            jest.fn().mockImplementation(async (_query, _variables) => {
              return Promise.reject('error')
            })
          ),
          blocks: createMockSubgraphComponent(
            jest.fn().mockResolvedValueOnce({
              min: [{ number: 123400 }],
              max: [{ number: 123500 }]
            })
          ),
          landManager: createMockSubgraphComponent(),
          ensOwner: createMockSubgraphComponent()
        },
        L2: {
          thirdPartyRegistry: createMockSubgraphComponent(),
          blocks: createMockSubgraphComponent(
            jest.fn().mockResolvedValueOnce({
              min: [{ number: 123400 }],
              max: [{ number: 123500 }]
            })
          ),
          collections: createMockSubgraphComponent(jest.fn().mockRejectedValue('error'))
        }
      })
      const { theGraphClient } = buildComponents({ subGraphs })

      await expect(
        theGraphClient.ownsItemsAtTimestamp(
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
