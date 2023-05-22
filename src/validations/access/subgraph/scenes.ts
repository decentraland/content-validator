import { EthAddress } from '@dcl/schemas'
import ms from 'ms'
import PQueue from 'p-queue'
import {
  DeploymentToValidate,
  ExternalCalls,
  fromErrors,
  SubgraphAccessCheckerComponents,
  ValidationResponse
} from '../../../types'

type Timestamp = number
type AddressSnapshot = {
  address: string
}

type EstateSnapshot = {
  estateId: number
}

type Estate = AuthorizationHistory & {
  id: number
}

type Parcel = AuthorizationHistory & {
  x: number
  y: number
  estates: EstateSnapshot[]
}

type AuthorizationHistory = {
  owners: AddressSnapshot[]
  operators: AddressSnapshot[]
  updateOperators: AddressSnapshot[]
}

type Authorization = {
  type: 'Operator' | 'ApprovalForAll' | 'UpdateManager'
  isApproved: boolean
}

/**
 * Checks if the given address has access to the given parcel at the given timestamp.
 * @public
 */
export function createSceneValidateFn({
  externalCalls,
  subGraphs,
  logs,
  tokenAddresses
}: Pick<SubgraphAccessCheckerComponents, 'externalCalls' | 'logs' | 'subGraphs' | 'tokenAddresses'>) {
  const logger = logs.getLogger('scenes access validator')

  const SCENE_LOOKBACK_TIME = ms('5m')
  const SCENE_VALIDATIONS_CONCURRENCY = process.env.SCENE_VALIDATIONS_CONCURRENCY
    ? parseInt(process.env.SCENE_VALIDATIONS_CONCURRENCY)
    : 10

  return async function validateFn(deployment: DeploymentToValidate): Promise<ValidationResponse> {
    const getAuthorizations = async (
      owner: EthAddress,
      operator: EthAddress,
      timestamp: Timestamp,
      tokenAddress: EthAddress
    ): Promise<Authorization[]> => {
      const query = `
          query GetAuthorizations($owner: String!, $operator: String!, $timestamp: Int!, $tokenAddress: String!) {
              authorizations(
                      where: {
                          owner: $owner,
                          operator: $operator,
                          createdAt_lte: $timestamp,
                          tokenAddress: $tokenAddress
                      },
                      orderBy: timestamp,
                      orderDirection: desc
                  ) {
                  type
                  isApproved
              }
          }`

      const variables = {
        owner,
        operator,
        timestamp: Math.floor(timestamp / 1000), // js(ms) -> UNIX(s)
        tokenAddress
      }

      try {
        return (
          await subGraphs.L1.landManager.query<{
            authorizations: Authorization[]
          }>(query, variables)
        ).authorizations
      } catch (error) {
        logger.error(`Error fetching authorizations for ${owner}`)
        throw error
      }
    }

    const getEstate = async (estateId: string, timestamp: Timestamp): Promise<Estate | undefined> => {
      /**
       * You can use `owner`, `operator` and `updateOperator` to check the current value for that estate.
       * Keep in mind that each association (owners, operators, etc) is capped to a thousand (1000) results.
       * For more information, you can use the query explorer at https://thegraph.com/explorer/subgraph/decentraland/land-manager
       */

      const query = `
          query GetEstate($estateId: String!, $timestamp: Int!) {
              estates(where:{ id: $estateId }) {
                  id
                  owners(
                          where: { createdAt_lte: $timestamp },
                          orderBy: timestamp,
                          orderDirection: desc,
                          first: 1
                      ) {
                      address
                  }
                  operators(
                          where: { createdAt_lte: $timestamp },
                          orderBy: timestamp,
                          orderDirection: desc,
                          first: 1
                      ) {
                      address
                  }
                  updateOperators(
                          where: { createdAt_lte: $timestamp },
                          orderBy: timestamp,
                          orderDirection: desc,
                          first: 1
                      ) {
                      address
                  }
              }
          }`

      const variables = {
        estateId,
        timestamp: Math.floor(timestamp / 1000) // UNIX
      }

      try {
        return (
          await subGraphs.L1.landManager.query<{
            estates: Estate[]
          }>(query, variables)
        ).estates[0]
      } catch (error) {
        logger.error(`Error fetching estate (${estateId})`)
        throw error
      }
    }

    const getParcel = async (x: number, y: number, timestamp: Timestamp): Promise<Parcel | undefined> => {
      /**
       * You can use `owner`, `operator` and `updateOperator` to check the current value for that parcel.
       * Keep in mind that each association (owners, operators, etc) is capped to a thousand (1000) results.
       * For more information, you can use the query explorer at https://thegraph.com/explorer/subgraph/decentraland/land-manager
       */

      const query = `
          query GetParcel($x: Int!, $y: Int!, $timestamp: Int!) {
              parcels(where:{ x: $x, y: $y }) {
                  estates(
                          where: { createdAt_lte: $timestamp },
                          orderBy: createdAt,
                          orderDirection: desc,
                          first: 1
                      ) {
                      estateId
                  }
                  owners(
                          where: { createdAt_lte: $timestamp },
                          orderBy: timestamp,
                          orderDirection: desc,
                          first: 1
                      ) {
                      address
                  }
                  operators(
                          where: { createdAt_lte: $timestamp },
                          orderBy: timestamp,
                          orderDirection: desc,
                          first: 1
                      ) {
                      address
                  }
                  updateOperators(
                          where: { createdAt_lte: $timestamp },
                          orderBy: timestamp,
                          orderDirection: desc,
                          first: 1
                      ) {
                      address
                  }
              }
          }`

      const variables = {
        x,
        y,
        timestamp: Math.floor(timestamp / 1000) // UNIX
      }

      try {
        const r = await subGraphs.L1.landManager.query<{
          parcels: Parcel[]
        }>(query, variables)

        if (r.parcels && r.parcels.length) return r.parcels[0]

        logger.error(`Error fetching parcel (${x}, ${y}, ${timestamp}): ${JSON.stringify(r)}`)
        throw new Error(`Error fetching parcel (${x}, ${y}), ${timestamp}`)
      } catch (error) {
        logger.error(`Error fetching parcel (${x}, ${y}, ${timestamp})`)
        throw error
      }
    }

    const hasAccessThroughAuthorizations = async (
      owner: EthAddress,
      ethAddress: EthAddress,
      timestamp: Timestamp,
      tokenAddress: EthAddress
    ): Promise<boolean> => {
      /* You also get access if you received:
       *   - an authorization with isApproved and type Operator, ApprovalForAll or UpdateManager
       * at that time
       */
      const authorizations = await getAuthorizations(
        owner.toLowerCase(),
        ethAddress.toLowerCase(),
        timestamp,
        tokenAddress.toLowerCase()
      )

      const firstOperatorAuthorization = authorizations.find((authorization) => authorization.type === 'Operator')
      const firstApprovalForAllAuthorization = authorizations.find(
        (authorization) => authorization.type === 'ApprovalForAll'
      )
      const firstUpdateManagerAuthorization = authorizations.find(
        (authorization) => authorization.type === 'UpdateManager'
      )

      if (
        firstOperatorAuthorization?.isApproved ||
        firstApprovalForAllAuthorization?.isApproved ||
        firstUpdateManagerAuthorization?.isApproved
      ) {
        return true
      }

      return false
    }

    const hasAccessThroughFirstLevelAuthorities = async (
      target: AuthorizationHistory,
      ethAddress: EthAddress
    ): Promise<boolean> => {
      const firstLevelAuthorities = [...target.owners, ...target.operators, ...target.updateOperators]
        .filter((addressSnapshot) => addressSnapshot.address)
        .map((addressSnapshot) => addressSnapshot.address.toLowerCase())
      return firstLevelAuthorities.includes(ethAddress.toLowerCase())
    }

    const isEstateUpdateAuthorized = async (
      estateId: number,
      timestamp: Timestamp,
      ethAddress: EthAddress
    ): Promise<boolean> => {
      const estate = await getEstate(estateId.toString(), timestamp)
      if (estate) {
        return (
          (await hasAccessThroughFirstLevelAuthorities(estate, ethAddress)) ||
          (await hasAccessThroughAuthorizations(estate.owners[0].address, ethAddress, timestamp, tokenAddresses.estate))
        )
      }
      throw new Error(`Couldn\'t find the state ${estateId}`)
    }

    const isParcelUpdateAuthorized = async (
      x: number,
      y: number,
      timestamp: Timestamp,
      ethAddress: EthAddress,
      _externalCalls: ExternalCalls
    ): Promise<boolean> => {
      /* You get direct access if you were the:
       *   - owner
       *   - operator
       *   - update operator
       * at that time
       */
      const parcel = await getParcel(x, y, timestamp)
      if (parcel) {
        const belongsToEstate: boolean =
          parcel.estates != undefined && parcel.estates.length > 0 && parcel.estates[0].estateId != undefined

        return (
          (await hasAccessThroughFirstLevelAuthorities(parcel, ethAddress)) ||
          (await hasAccessThroughAuthorizations(
            parcel.owners[0].address,
            ethAddress,
            timestamp,
            tokenAddresses.land
          )) ||
          (belongsToEstate && (await isEstateUpdateAuthorized(parcel.estates[0].estateId, timestamp, ethAddress)))
        )
      }
      throw new Error(`Parcel(${x},${y},${timestamp}) not found`)
    }

    const checkParcelAccess = async (
      x: number,
      y: number,
      timestamp: Timestamp,
      ethAddress: EthAddress,
      externalCalls: ExternalCalls
    ): Promise<boolean> => {
      try {
        return await retry(() => isParcelUpdateAuthorized(x, y, timestamp, ethAddress, externalCalls), 5, '0.1s')
      } catch (error) {
        logger.error(`Error checking parcel access (${x}, ${y}, ${timestamp}, ${ethAddress}).`)
        throw error
      }
    }

    const { entity } = deployment
    const { pointers, timestamp } = entity
    const ethAddress = externalCalls.ownerAddress(deployment.auditInfo)

    const errors = []
    const lowerCasePointers = pointers.map((pointer) => pointer.toLowerCase())

    const queue = new PQueue({ concurrency: SCENE_VALIDATIONS_CONCURRENCY })
    const controller = new AbortController()

    for (const pointer of lowerCasePointers) {
      const pointerParts: string[] = pointer.split(',')
      if (pointerParts.length === 2) {
        const x: number = parseInt(pointerParts[0], 10)
        const y: number = parseInt(pointerParts[1], 10)

        // Check that the address has access (we check both the present and the 5 min into the past to avoid synchronization issues in the blockchain)
        queue
          .add(async () => {
            if (!controller.signal.aborted) {
              const hasAccess =
                (await checkParcelAccess(x, y, timestamp, ethAddress, externalCalls)) ||
                (await checkParcelAccess(x, y, timestamp - SCENE_LOOKBACK_TIME, ethAddress, externalCalls))

              if (!hasAccess) {
                errors.push(`The provided Eth Address does not have access to the following parcel: (${x},${y})`)
                controller.abort()
              }
            }
          })
          .catch((error) => {
            errors.push(`The provided Eth Address does not have access to the following parcel: (${x},${y}). ${error}`)
            controller.abort()
          })
      } else {
        errors.push(
          `Scene pointers should only contain two integers separated by a comma, for example (10,10) or (120,-45). Invalid pointer: ${pointer}`
        )
        controller.abort()
      }
    }

    await queue.onIdle()

    return fromErrors(...errors)
  }
}

/** @internal */
async function retry<T>(
  execution: () => Promise<T>,
  attempts: number,
  waitTime: string = '1s',
  failedAttemptCallback?: (attemptsLeft: number) => void
): Promise<T> {
  while (attempts > 0) {
    try {
      return await execution()
      //     ^^^^^ never remove this "await" keyword, otherwise this function won't
      //           catch the exception and perform the retries
    } catch (error) {
      attempts--
      if (attempts > 0) {
        if (failedAttemptCallback) {
          failedAttemptCallback(attempts)
        }
        await new Promise<void>((res) => setTimeout(res, ms(waitTime)))
      } else {
        throw error
      }
    }
  }
  throw new Error('Please specify more than one attempt for the retry function')
}
