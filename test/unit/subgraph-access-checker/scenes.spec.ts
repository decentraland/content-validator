import { createSceneValidateFn } from '../../../src/validations/access/subgraph/scenes'
import { buildSceneDeployment } from '../../setup/deployments'
import { buildExternalCalls } from '../../setup/mock'
import { buildSubGraphs, buildSubgraphAccessCheckerComponents } from './mock'

describe('Access: scenes', () => {
  it('When a non-decentraland address tries to deploy a default scene, then an error is returned', async () => {
    // Arrange
    const pointers = ['Default10']
    const deployment = buildSceneDeployment(pointers)
    const externalCalls = buildExternalCalls({
      isAddressOwnedByDecentraland: () => false,
      ownerAddress: () => '0xAddress'
    })

    // Act
    const validateFn = createSceneValidateFn(buildSubgraphAccessCheckerComponents({ externalCalls }))
    const response = await validateFn(deployment)

    // Assert
    expect(response.ok).toBeFalsy()
    expect(response.errors).toContain(
      'Scene pointers should only contain two integers separated by a comma, for example (10,10) or (120,-45). Invalid pointer: default10'
    )
  })

  it('When a decentraland address tries to deploy an default scene, then it is not allowed', async () => {
    // Arrange
    const pointers = ['Default10']
    const deployment = buildSceneDeployment(pointers)
    const externalCalls = buildExternalCalls({
      isAddressOwnedByDecentraland: () => true,
      ownerAddress: () => '0xAddress'
    })

    // Act
    const validateFn = createSceneValidateFn(buildSubgraphAccessCheckerComponents({ externalCalls }))
    const response = await validateFn(deployment)

    // Assert
    expect(response.ok).toBeFalsy()
  })

  it('When non-urns are used as pointers, then validation fails', async () => {
    // Arrange
    const pointers = ['invalid-pointer']
    const deployment = buildSceneDeployment(pointers)
    const externalCalls = buildExternalCalls({
      isAddressOwnedByDecentraland: () => true,
      ownerAddress: () => '0xAddress'
    })

    // Act
    const validateFn = createSceneValidateFn(buildSubgraphAccessCheckerComponents({ externalCalls }))
    const response = await validateFn(deployment)

    // Assert
    expect(response.ok).toBeFalsy()
    expect(response.errors).toContain(
      'Scene pointers should only contain two integers separated by a comma, for example (10,10) or (120,-45). Invalid pointer: invalid-pointer'
    )
  })

  it('When valid deployment is sent, then the validation passes', async () => {
    // Arrange
    const pointers = ['0,1']
    const deployment = buildSceneDeployment(pointers)
    const externalCalls = buildExternalCalls({
      isAddressOwnedByDecentraland: () => true,
      ownerAddress: () => '0xAddress'
    })

    const subgraphsMocks = buildSubGraphs({
      L1: {
        blocks: { query: jest.fn() },
        ensOwner: { query: jest.fn() },
        collections: { query: jest.fn() },
        landManager: {
          query: jest.fn().mockResolvedValue(
            generateGetParcelResponseFromPointers(
              [
                [0, 1],
                [2, 3],
                [4, 5],
                [5, 6]
              ],
              '0xAddress'
            )
          )
        }
      }
    })

    // Act
    const validateFn = createSceneValidateFn(
      buildSubgraphAccessCheckerComponents({
        externalCalls,
        subGraphs: subgraphsMocks
      })
    )

    const response = await validateFn(deployment)

    // Assert
    expect(subgraphsMocks.L1.landManager.query).toHaveBeenCalledTimes(1)
    expect(response.ok).toBeTruthy()
    expect(response.errors).toBeUndefined()
  })

  it('When a pointer validation = false, then the validation returns false and the pending checks are avoided w/concurrency=1', async () => {
    // Arrange
    process.env.SCENE_VALIDATIONS_CONCURRENCY = '1'
    const pointers = ['0,1', '9,9', '2,3', '4,5', '5,6']
    const deployment = buildSceneDeployment(pointers)
    const externalCalls = buildExternalCalls({
      isAddressOwnedByDecentraland: () => true,
      ownerAddress: () => '0xAddress'
    })

    const queryMock = jest.fn()
    const subgraphsMocks = buildSubGraphs({
      L1: {
        blocks: { query: jest.fn() },
        ensOwner: { query: jest.fn() },
        collections: { query: jest.fn() },
        landManager: { query: queryMock }
      }
    })

    const notOwnedParcels = generateGetParcelResponseFromPointers(
      [
        [0, 1],
        [2, 3],
        [4, 5],
        [5, 6]
      ],
      '0xDifferent'
    )

    queryMock
      .mockResolvedValueOnce(
        generateGetParcelResponseFromPointers(
          [
            [0, 1],
            [2, 3],
            [4, 5],
            [5, 6]
          ],
          '0xAddress'
        )
      )
      .mockImplementation((_query, variables) => {
        if (variables.x === 9 && variables.y === 9) return new Promise((resolve) => resolve(notOwnedParcels))

        if (variables.owner === '0xdifferent')
          return new Promise((resolve) =>
            resolve({
              authorizations: [
                { type: 'Operator', isApproved: false },
                { type: 'ApprovalForAll', isApproved: false },
                { type: 'UpdateManager', isApproved: false }
              ]
            })
          )
      })

    // Act
    const validateFn = createSceneValidateFn(
      buildSubgraphAccessCheckerComponents({
        externalCalls,
        subGraphs: subgraphsMocks
      })
    )

    const response = await validateFn(deployment)

    // Assert
    expect(response.ok).toBeFalsy()
    expect(response.errors).toContain('The provided Eth Address does not have access to the following parcel: (9,9)')

    // Verify that after one validation fails, the other ones are not executed
    expect(subgraphsMocks.L1.landManager.query).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        x: 2,
        y: 3
      })
    )

    expect(subgraphsMocks.L1.landManager.query).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        x: 4,
        y: 5
      })
    )

    expect(subgraphsMocks.L1.landManager.query).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        x: 5,
        y: 6
      })
    )
  })

  it.only('When a validation fails, then the validation returns false and the pending checks are avoided w/concurrency=2', async () => {
    // Arrange
    process.env.SCENE_VALIDATIONS_CONCURRENCY = '2'
    const pointers = ['0,1', '2,3', '9,9', '4,5', '5,6', '4,4', '4,4', '9,9', '9,9']
    const deployment = buildSceneDeployment(pointers)
    const externalCalls = buildExternalCalls({
      isAddressOwnedByDecentraland: () => true,
      ownerAddress: () => '0xAddress'
    })

    const queryMock = jest.fn()
    const subgraphsMocks = buildSubGraphs({
      L1: {
        blocks: { query: jest.fn() },
        ensOwner: { query: jest.fn() },
        collections: { query: jest.fn() },
        landManager: { query: queryMock }
      }
    })

    const notOwnedParcels = generateGetParcelResponseFromPointers(
      [
        [0, 1],
        [2, 3],
        [4, 5],
        [5, 6]
      ],
      '0xDifferent'
    )

    queryMock.mockImplementation((_query, variables) => {
      if (variables.x === 9 && variables.y === 9) return new Promise((resolve) => resolve(notOwnedParcels))

      if (variables.owner === '0xdifferent')
        return new Promise((resolve) =>
          resolve({
            authorizations: [
              { type: 'Operator', isApproved: false },
              { type: 'ApprovalForAll', isApproved: false },
              { type: 'UpdateManager', isApproved: false }
            ]
          })
        )

      return generateGetParcelResponseFromPointers(
        [
          [0, 1],
          [2, 3],
          [4, 5],
          [5, 6]
        ],
        '0xAddress'
      )
    })

    // Act
    const validateFn = createSceneValidateFn(
      buildSubgraphAccessCheckerComponents({
        externalCalls,
        subGraphs: subgraphsMocks
      })
    )

    const response = await validateFn(deployment)

    expect(response.ok).toBeFalsy()
    // The rest of the errors are not added because the validation chain is aborted as soon as the first fails
    expect(response.errors?.length).toBe(1)
  })
})

const generateGetParcelResponseFromPointers = (pointers: number[][], address: string) => ({
  parcels: pointers.map((pointer) => ({
    owners: [{ address: address }],
    operators: [],
    updateOperators: [],
    x: pointer[0],
    y: pointer[1]
  }))
})
