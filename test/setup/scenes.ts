import { Scene } from '@dcl/schemas'

export const VALID_SCENE_METADATA: Scene = {
  display: {
    title: 'My own scene',
    description: 'My place in the world',
    favicon: 'favicon_asset',
    navmapThumbnail: 'scene-thumbnail.png'
  },
  owner: '',
  contact: {
    name: 'Call me Jimmy',
    email: ''
  },
  main: 'bin/game.js',
  tags: [],
  scene: {
    parcels: ['0,24'],
    base: '0,24'
  },
  // worldConfiguration: {
  //   skybox: 36000,
  //   minimapVisible: false,
  //   fixedAdapter: 'offline:offline',
  //   name: 'mariano.dcl.eth'
  // },
  source: {
    version: 1,
    origin: 'builder',
    projectId: '70bbe5e9-460c-4d1b-bb9f-7597e71747df',
    point: {
      x: 0,
      y: 0
    },
    rotation: 'east',
    layout: {
      rows: 1,
      cols: 1
    }
  }
}
