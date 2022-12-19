import { createAvlBlockSearch, metricsDefinitions } from '@dcl/block-indexer'
import { createTestMetricsComponent } from '@well-known-components/metrics'
import { timestampBounds } from '../../../src/the-graph-client/the-graph-client'
import {
  buildComponents,
  buildLogger,
  buildSubGraphs,
  createMockBlockRepository,
  createMockSubgraphComponent
} from '../../setup/mock'

const currentTimestamp = 1000
const bounds = timestampBounds(currentTimestamp)

describe('TheGraphClient', () => {
  const logs = buildLogger()
  const metrics = createTestMetricsComponent(metricsDefinitions)

  it('When invocation to TheGraph throws an error, it is reported accordingly', async () => {
    const subGraphs = buildSubGraphs({
      l1BlockSearch: createAvlBlockSearch({
        logs,
        metrics,
        blockRepository: createMockBlockRepository(10, {})
      })
    })
    subGraphs.l1BlockSearch.findBlockForTimestamp = jest.fn().mockImplementation(() => {
      throw new Error('error')
    })

    const { theGraphClient } = buildComponents({ subGraphs })

    await expect(theGraphClient.ownsNamesAtTimestamp('0x1', ['Some Name'], 10)).rejects.toThrow('error')
  })

  it('When invoking findBlocksForTimestamp, it may happen that no block matches and exception is thrown', async () => {
    const subGraphs = buildSubGraphs()

    const { theGraphClient } = buildComponents({ subGraphs })

    await expect(theGraphClient.findBlocksForTimestamp(10, subGraphs.l1BlockSearch)).rejects.toThrow(
      'Block 0 could not be retrieved'
    )
  })

  describe('Checks for name ownership', function () {
    it('When no block for current timestamp, it should continue and check the block from 5 minute before', async () => {
      const subGraphs = buildSubGraphs({
        L1: {
          collections: createMockSubgraphComponent(),
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
        },
        l1BlockSearch: createAvlBlockSearch({
          logs,
          metrics,
          blockRepository: createMockBlockRepository(10, {})
        })
      })

      subGraphs.l1BlockSearch.findBlockForTimestamp = jest.fn().mockImplementation((t) => {
        if (t === bounds.upper) {
          return undefined
        }
        return { timestamp: bounds.lower, block: 123400 }
      })

      const { theGraphClient } = buildComponents({ subGraphs })

      await expect(theGraphClient.ownsNamesAtTimestamp('0x1', ['Some Name'], currentTimestamp)).resolves.toEqual({
        result: true
      })
    })

    it('When current block has not been indexed yet, it should continue and check the block from 5 minute before', async () => {
      const subGraphs = buildSubGraphs({
        L1: {
          collections: createMockSubgraphComponent(),
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

      subGraphs.l1BlockSearch.findBlockForTimestamp = jest.fn().mockImplementation((t) => {
        if (t === bounds.upper) {
          return { timestamp: bounds.upper, block: 123500 }
        }
        return { timestamp: bounds.lower, block: 123400 }
      })

      const { theGraphClient } = buildComponents({ subGraphs })

      await expect(theGraphClient.ownsNamesAtTimestamp('0x1', ['Some Name'], currentTimestamp)).resolves.toEqual({
        result: true
      })
    })

    it('When both current and 5-min before blocks have not been indexed yet, it should report error', async () => {
      const subGraphs = buildSubGraphs({
        L1: {
          collections: createMockSubgraphComponent(),
          landManager: createMockSubgraphComponent(),
          ensOwner: createMockSubgraphComponent(jest.fn().mockRejectedValue('error'))
        }
      })
      const { theGraphClient } = buildComponents({ subGraphs })

      subGraphs.l1BlockSearch.findBlockForTimestamp = jest.fn().mockImplementation(() => {
        return undefined
      })

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
          landManager: createMockSubgraphComponent(),
          ensOwner: createMockSubgraphComponent(jest.fn().mockRejectedValue('error'))
        },
        L2: {
          thirdPartyRegistry: createMockSubgraphComponent(),
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

      subGraphs.l1BlockSearch.findBlockForTimestamp = jest.fn().mockImplementation((t) => {
        if (t === bounds.upper) {
          return undefined
        }
        return { timestamp: bounds.lower, block: 123400 }
      })
      subGraphs.l2BlockSearch.findBlockForTimestamp = jest.fn().mockImplementation((t) => {
        if (t === bounds.upper) {
          return undefined
        }
        return { timestamp: bounds.lower, block: 123400 }
      })

      const { theGraphClient } = buildComponents({ subGraphs })

      await expect(
        theGraphClient.ownsItemsAtTimestamp(
          '0x1',
          [
            'urn:decentraland:ethereum:collections-v1:rtfkt_x_atari:p_rtfkt_x_atari_feet',
            'urn:decentraland:matic:collections-v2:0x04e7f74e73e951c61edd80910e46c3fece5ebe80:2'
          ],
          currentTimestamp
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
          landManager: createMockSubgraphComponent(),
          ensOwner: createMockSubgraphComponent()
        },
        L2: {
          thirdPartyRegistry: createMockSubgraphComponent(),
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

      subGraphs.l1BlockSearch.findBlockForTimestamp = jest.fn().mockImplementation((t) => {
        if (t === bounds.upper) {
          return { timestamp: bounds.upper, block: 123500 }
        }
        return { timestamp: bounds.lower, block: 123400 }
      })
      subGraphs.l2BlockSearch.findBlockForTimestamp = jest.fn().mockImplementation((t) => {
        if (t === bounds.upper) {
          return { timestamp: bounds.upper, block: 123500 }
        }
        return { timestamp: bounds.lower, block: 123400 }
      })

      await expect(
        theGraphClient.ownsItemsAtTimestamp(
          '0x1',
          [
            'urn:decentraland:ethereum:collections-v1:rtfkt_x_atari:p_rtfkt_x_atari_feet',
            'urn:decentraland:matic:collections-v2:0x04e7f74e73e951c61edd80910e46c3fece5ebe80:2'
          ],
          currentTimestamp
        )
      ).resolves.toEqual({ result: true })
    })

    it('When both current and 5-min before blocks have not been indexed yet, it should report error', async () => {
      const subGraphs = buildSubGraphs({
        L1: {
          collections: createMockSubgraphComponent(jest.fn().mockRejectedValue('error')),
          landManager: createMockSubgraphComponent(),
          ensOwner: createMockSubgraphComponent()
        },
        L2: {
          thirdPartyRegistry: createMockSubgraphComponent(),
          collections: createMockSubgraphComponent(jest.fn().mockRejectedValue('error'))
        }
      })
      const { theGraphClient } = buildComponents({ subGraphs })

      subGraphs.l1BlockSearch.findBlockForTimestamp = jest.fn().mockImplementation((t) => {
        if (t === bounds.upper) {
          return { timestamp: bounds.upper, block: 123500 }
        }
        return { timestamp: bounds.lower, block: 123400 }
      })
      subGraphs.l2BlockSearch.findBlockForTimestamp = jest.fn().mockImplementation((t) => {
        if (t === bounds.upper) {
          return { timestamp: bounds.upper, block: 123500 }
        }
        return { timestamp: bounds.lower, block: 123400 }
      })
      await expect(
        theGraphClient.ownsItemsAtTimestamp(
          '0x1',
          [
            'urn:decentraland:ethereum:collections-v1:rtfkt_x_atari:p_rtfkt_x_atari_feet',
            'urn:decentraland:matic:collections-v2:0x04e7f74e73e951c61edd80910e46c3fece5ebe80:2'
          ],
          currentTimestamp
        )
      ).resolves.toEqual({ result: false, failing: [] })
    })
  })
})
