import { EthAddress } from '@dcl/schemas'
import { retry, Timestamp } from 'dcl-catalyst-commons'
import ms from 'ms'
import { ExternalCalls, fromErrors, Validation } from '../../types'

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

const getAuthorizations = async (
  owner: EthAddress,
  operator: EthAddress,
  timestamp: Timestamp,
  externalCalls: ExternalCalls
): Promise<Authorization[]> => {
  const query = `
            query GetAuthorizations($owner: String!, $operator: String!, $timestamp: Int!) {
                authorizations(
                        where: {
                            owner: $owner,
                            operator: $operator,
                            createdAt_lte: $timestamp
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
  }

  try {
    return (
      await externalCalls.queryGraph<{ authorizations: Authorization[] }>(
        externalCalls.subgraphs.L1.landManager,
        query,
        variables
      )
    ).authorizations
  } catch (error) {
    // this.LOGGER.error(`Error fetching authorizations for ${owner}`, error)
    throw error
  }
}

const getEstate = async (
  estateId: string,
  timestamp: Timestamp,
  externalCalls: ExternalCalls
): Promise<Estate | undefined> => {
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
    timestamp: Math.floor(timestamp / 1000), // UNIX
  }

  try {
    return (
      await externalCalls.queryGraph<{ estates: Estate[] }>(externalCalls.subgraphs.L1.landManager, query, variables)
    ).estates[0]
  } catch (error) {
    // this.LOGGER.error(`Error fetching estate (${estateId})`, error)
    throw error
  }
}

const getParcel = async (
  x: number,
  y: number,
  timestamp: Timestamp,
  externalCalls: ExternalCalls
): Promise<Parcel | undefined> => {
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
    timestamp: Math.floor(timestamp / 1000), // UNIX
  }

  try {
    const r = await externalCalls.queryGraph<{ parcels: Parcel[] }>(
      externalCalls.subgraphs.L1.landManager,
      query,
      variables
    )

    if (r.parcels && r.parcels.length) return r.parcels[0]

    // this.LOGGER.error(`Error fetching parcel (${x}, ${y}, ${timestamp}): ${JSON.stringify(r)}`)
    throw new Error(`Error fetching parcel (${x}, ${y}), ${timestamp}`)
  } catch (error) {
    // this.LOGGER.error(`Error fetching parcel (${x}, ${y}, ${timestamp})`, error)
    throw error
  }
}

const hasAccessThroughAuthorizations = async (
  owner: EthAddress,
  ethAddress: EthAddress,
  timestamp: Timestamp,
  externalCalls: ExternalCalls
): Promise<boolean> => {
  /* You also get access if you received:
   *   - an authorization with isApproved and type Operator, ApprovalForAll or UpdateManager
   * at that time
   */
  const authorizations = await getAuthorizations(
    owner.toLowerCase(),
    ethAddress.toLowerCase(),
    timestamp,
    externalCalls
  )

  const firstOperatorAuthorization = authorizations.find((authorization) => authorization.type === 'Operator')
  const firstApprovalForAllAuthorization = authorizations.find(
    (authorization) => authorization.type === 'ApprovalForAll'
  )
  const firstUpdateManagerAuthorization = authorizations.find((authorization) => authorization.type === 'UpdateManager')

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
  ethAddress: EthAddress,
  externalCalls: ExternalCalls
): Promise<boolean> => {
  const estate = await getEstate(estateId.toString(), timestamp, externalCalls)
  if (estate) {
    return (
      (await hasAccessThroughFirstLevelAuthorities(estate, ethAddress)) ||
      (await hasAccessThroughAuthorizations(estate.owners[0].address, ethAddress, timestamp, externalCalls))
    )
  }
  throw new Error(`Couldn\'t find the state ${estateId}`)
}

const isParcelUpdateAuthorized = async (
  x: number,
  y: number,
  timestamp: Timestamp,
  ethAddress: EthAddress,
  externalCalls: ExternalCalls
): Promise<boolean> => {
  /* You get direct access if you were the:
   *   - owner
   *   - operator
   *   - update operator
   * at that time
   */
  const parcel = await getParcel(x, y, timestamp, externalCalls)
  if (parcel) {
    const belongsToEstate: boolean =
      parcel.estates != undefined && parcel.estates.length > 0 && parcel.estates[0].estateId != undefined

    return (
      (await hasAccessThroughFirstLevelAuthorities(parcel, ethAddress)) ||
      (await hasAccessThroughAuthorizations(parcel.owners[0].address, ethAddress, timestamp, externalCalls)) ||
      (belongsToEstate &&
        (await isEstateUpdateAuthorized(parcel.estates[0].estateId, timestamp, ethAddress, externalCalls)))
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
    // this.LOGGER.error(`Error checking parcel access (${x}, ${y}, ${timestamp}, ${ethAddress}).`, error)
    throw error
  }
}

const SCENE_LOOKBACK_TIME = ms('5m')

export const scenes: Validation = {
  validate: async ({ deployment, externalCalls }) => {
    const { entity } = deployment
    const { pointers, timestamp } = entity
    const ethAddress = externalCalls.ownerAddress(deployment.auditInfo)

    const errors = []
    const lowerCasePointers = pointers.map((pointer) => pointer.toLowerCase())

    for (const pointer of lowerCasePointers) {
      if (pointer.startsWith('default')) {
        if (!externalCalls.isAddressOwnedByDecentraland(ethAddress)) {
          errors.push(`Only Decentraland can add or modify default scenes`)
        }
      } else {
        const pointerParts: string[] = pointer.split(',')
        if (pointerParts.length === 2) {
          const x: number = parseInt(pointerParts[0], 10)
          const y: number = parseInt(pointerParts[1], 10)
          try {
            // Check that the address has access (we check both the present and the 5 min into the past to avoid synchronization issues in the blockchain)
            const hasAccess =
              (await checkParcelAccess(x, y, timestamp, ethAddress, externalCalls)) ||
              (await checkParcelAccess(x, y, timestamp - SCENE_LOOKBACK_TIME, ethAddress, externalCalls))
            if (!hasAccess) {
              errors.push(`The provided Eth Address does not have access to the following parcel: (${x},${y})`)
            }
          } catch (e) {
            errors.push(`The provided Eth Address does not have access to the following parcel: (${x},${y}). ${e}`)
          }
        } else {
          errors.push(
            `Scene pointers should only contain two integers separated by a comma, for example (10,10) or (120,-45). Invalid pointer: ${pointer}`
          )
        }
      }
    }

    return fromErrors(...errors)
  },
}
