import { createAvlBlockSearch, metricsDefinitions } from '@dcl/block-indexer'
import { createTestMetricsComponent } from '@well-known-components/metrics'
import { timestampBounds } from '../../../src/validations/access/on-chain/client'
import { createMockItemCheckerComponent } from '../../setup/mock'
import { buildOnChainAccessCheckerComponents, createMockBlockRepository } from './mock'

const currentTimestamp = 1000
const bounds = timestampBounds(currentTimestamp)

describe('OnChainClient', () => {
  it('When invocation to TheGraph throws an error, it is reported accordingly', async () => {
    const components = buildOnChainAccessCheckerComponents()
    components.L1.blockSearch.findBlockForTimestamp = jest.fn().mockImplementation(() => {
      throw new Error('error')
    })

    await expect(components.client.ownsNamesAtTimestamp('0x1', ['Some Name'], 10)).rejects.toThrow('error')
  })

  it('When invoking findBlocksForTimestamp, it may happen that no block matches and exception is thrown', async () => {
    const components = buildOnChainAccessCheckerComponents()
    await expect(components.client.findBlocksForTimestamp(10, components.L1.blockSearch)).rejects.toThrow(
      'Block 0 could not be retrieved'
    )
  })

  describe('Checks for name ownership', function () {
    it('When no block for current timestamp, it should continue and check the block from 5 minute before', async () => {
      const components = buildOnChainAccessCheckerComponents()
      components.L1.blockSearch = createAvlBlockSearch({
        logs: components.logs,
        metrics: createTestMetricsComponent(metricsDefinitions),
        blockRepository: createMockBlockRepository(10, {})
      })
      components.L1.blockSearch.findBlockForTimestamp = jest.fn().mockImplementation((t) => {
        if (t === bounds.upper) {
          return undefined
        }
        return { timestamp: bounds.lower, block: 123400 }
      })
      components.L1.checker.checkNames = jest.fn((_ethAddress, _name, block) => {
        return Promise.resolve([block === 123400])
      })

      await expect(components.client.ownsNamesAtTimestamp('0x1', ['Some Name'], 10)).resolves.toEqual({
        result: true
      })
    })

    it('When current block has not been indexed yet, it should continue and check the block from 5 minute before', async () => {
      const components = buildOnChainAccessCheckerComponents()

      components.L1.blockSearch.findBlockForTimestamp = jest.fn().mockImplementation((t) => {
        if (t === bounds.upper) {
          return { timestamp: bounds.upper, block: 123500 }
        }
        return { timestamp: bounds.lower, block: 123400 }
      })

      components.L1.checker.checkNames = jest.fn((_ethAddress, _name, block) => {
        return Promise.resolve([block === 123400])
      })

      await expect(components.client.ownsNamesAtTimestamp('0x1', ['Some Name'], currentTimestamp)).resolves.toEqual({
        result: true
      })
    })

    it('When both current and 5-min before blocks have not been indexed yet, it should report error', async () => {
      const components = buildOnChainAccessCheckerComponents()
      components.L1.blockSearch.findBlockForTimestamp = jest.fn().mockImplementation(() => {
        return undefined
      })

      await expect(components.client.ownsNamesAtTimestamp('0x1', ['Some Name'], 10)).resolves.toEqual({
        result: false
      })
    })
  })

  describe('Checks for wearables ownership', function () {
    it('When no block for current timestamp, it should continue and check the block from 5 minute before', async () => {
      const components = buildOnChainAccessCheckerComponents()
      components.L1.collections = createMockItemCheckerComponent(jest.fn().mockResolvedValue([true]))
      components.L2.collections = createMockItemCheckerComponent(jest.fn().mockResolvedValue([true]))
      components.L1.blockSearch.findBlockForTimestamp = jest.fn().mockImplementation((t) => {
        if (t === bounds.upper) {
          return undefined
        }
        return { timestamp: bounds.lower, block: 123400 }
      })
      components.L2.blockSearch.findBlockForTimestamp = jest.fn().mockImplementation((t) => {
        if (t === bounds.upper) {
          return undefined
        }
        return { timestamp: bounds.lower, block: 123400 }
      })

      await expect(
        components.client.ownsItemsAtTimestamp(
          '0x1',
          [
            'urn:decentraland:ethereum:collections-v1:rtfkt_x_atari:p_rtfkt_x_atari_feet:123',
            'urn:decentraland:matic:collections-v2:0x04e7f74e73e951c61edd80910e46c3fece5ebe80:2'
          ],
          10
        )
      ).resolves.toEqual({ result: true })
    })

    it('When current block has not been indexed yet, it should continue and check the block from 5 minute before', async () => {
      const components = buildOnChainAccessCheckerComponents()
      components.L1.collections = createMockItemCheckerComponent(
        jest.fn().mockImplementation(async (_query, _variables) => {
          if (_variables['block'] === 123500) {
            return Promise.reject('error')
          } else {
            return Promise.resolve([true])
          }
        })
      )
      components.L2.collections = createMockItemCheckerComponent(jest.fn().mockResolvedValue([true]))

      components.L1.blockSearch.findBlockForTimestamp = jest.fn().mockImplementation((t) => {
        if (t === bounds.upper) {
          return { timestamp: bounds.upper, block: 123500 }
        }
        return { timestamp: bounds.lower, block: 123400 }
      })
      components.L2.blockSearch.findBlockForTimestamp = jest.fn().mockImplementation((t) => {
        if (t === bounds.upper) {
          return { timestamp: bounds.upper, block: 123500 }
        }
        return { timestamp: bounds.lower, block: 123400 }
      })

      await expect(
        components.client.ownsItemsAtTimestamp(
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
      const components = buildOnChainAccessCheckerComponents()
      components.L1.collections = createMockItemCheckerComponent(jest.fn().mockRejectedValue('error'))
      components.L2.collections = createMockItemCheckerComponent(jest.fn().mockRejectedValue('error'))

      components.L1.blockSearch.findBlockForTimestamp = jest.fn().mockImplementation((t) => {
        if (t === bounds.upper) {
          return { timestamp: bounds.upper, block: 123500 }
        }
        return { timestamp: bounds.lower, block: 123400 }
      })
      components.L2.blockSearch.findBlockForTimestamp = jest.fn().mockImplementation((t) => {
        if (t === bounds.upper) {
          return { timestamp: bounds.upper, block: 123500 }
        }
        return { timestamp: bounds.lower, block: 123400 }
      })
      await expect(
        components.client.ownsItemsAtTimestamp(
          '0x1',
          [
            'urn:decentraland:ethereum:collections-v1:rtfkt_x_atari:p_rtfkt_x_atari_feet:4',
            'urn:decentraland:matic:collections-v2:0x04e7f74e73e951c61edd80910e46c3fece5ebe80:2'
          ],
          currentTimestamp
        )
      ).resolves.toEqual({ result: false, failing: [] })
    })

    it.each([
      [
        'urn:decentraland:ethereum:collections-v1:rtfkt_x_atari:p_rtfkt_x_atari_feet',
        'urn:decentraland:matic:collections-v2:0x04e7f74e73e951c61edd80910e46c3fece5ebe80:2'
      ],
      [
        'urn:decentraland:ethereum:collections-v1:rtfkt_x_atari:p_rtfkt_x_atari_feet:123',
        'urn:decentraland:matic:collections-v2:0x04e7f74e73e951c61edd80910e46c3fece5ebe80:2:321'
      ]
    ])(
      'should validate ownership of v1 and v2 wearables (passing and not passing tokenId)',
      async (l1UrnToValidate, l2UrnToValidate) => {
        const components = buildOnChainAccessCheckerComponents()
        components.L1.collections = createMockItemCheckerComponent(jest.fn().mockResolvedValue([true]))
        components.L2.collections = createMockItemCheckerComponent(jest.fn().mockResolvedValue([true]))
        components.L1.blockSearch.findBlockForTimestamp = jest.fn().mockImplementation((t) => {
          if (t === bounds.upper) {
            return undefined
          }
          return { timestamp: bounds.lower, block: 123400 }
        })
        components.L2.blockSearch.findBlockForTimestamp = jest.fn().mockImplementation((t) => {
          if (t === bounds.upper) {
            return undefined
          }
          return { timestamp: bounds.lower, block: 123400 }
        })

        await expect(
          components.client.ownsItemsAtTimestamp('0x1', [l1UrnToValidate, l2UrnToValidate], 10)
        ).resolves.toEqual({ result: true })
      }
    )

    it('should fail validate ownership of v1 and v2 items with invalid token id', async () => {
      const components = buildOnChainAccessCheckerComponents()
      components.L1.blockSearch.findBlockForTimestamp = jest.fn().mockImplementation((t) => {
        if (t === bounds.upper) {
          return undefined
        }
        return { timestamp: bounds.lower, block: 123400 }
      })
      components.L2.blockSearch.findBlockForTimestamp = jest.fn().mockImplementation((t) => {
        if (t === bounds.upper) {
          return undefined
        }
        return { timestamp: bounds.lower, block: 123400 }
      })

      await expect(
        components.client.ownsItemsAtTimestamp(
          '0x1',
          [
            'urn:decentraland:ethereum:collections-v1:rtfkt_x_atari:p_rtfkt_x_atari_feet:124',
            'urn:decentraland:matic:collections-v2:0x04e7f74e73e951c61edd80910e46c3fece5ebe80:2:124'
          ],
          10
        )
      ).resolves.toEqual({
        result: false,
        failing: [
          'urn:decentraland:ethereum:collections-v1:rtfkt_x_atari:p_rtfkt_x_atari_feet:124',
          'urn:decentraland:matic:collections-v2:0x04e7f74e73e951c61edd80910e46c3fece5ebe80:2:124'
        ]
      })
    })

    it('should fail validate ownership of a single wearable which has invalid token id', async () => {
      const components = buildOnChainAccessCheckerComponents()
      components.L1.collections = createMockItemCheckerComponent(jest.fn().mockResolvedValue([true]))
      components.L2.collections = createMockItemCheckerComponent(jest.fn().mockResolvedValue([false]))
      components.L1.blockSearch.findBlockForTimestamp = jest.fn().mockImplementation((t) => {
        if (t === bounds.upper) {
          return undefined
        }
        return { timestamp: bounds.lower, block: 123400 }
      })
      components.L2.blockSearch.findBlockForTimestamp = jest.fn().mockImplementation((t) => {
        if (t === bounds.upper) {
          return undefined
        }
        return { timestamp: bounds.lower, block: 123400 }
      })

      await expect(
        components.client.ownsItemsAtTimestamp(
          '0x1',
          [
            'urn:decentraland:ethereum:collections-v1:rtfkt_x_atari:p_rtfkt_x_atari_feet:123',
            'urn:decentraland:matic:collections-v2:0x04e7f74e73e951c61edd80910e46c3fece5ebe80:2:124'
          ],
          10
        )
      ).resolves.toEqual({
        result: false,
        failing: ['urn:decentraland:matic:collections-v2:0x04e7f74e73e951c61edd80910e46c3fece5ebe80:2:124']
      })
    })
  })
})
