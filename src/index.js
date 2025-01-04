let config = {
  sparcApi: import.meta.env.VITE_SPARC_API || 'http://localhost:8000',
}

export const configure = (options) => {
  config = { ...config, ...options }
}

export const useConfig = () => {
  return config
}

import RevaWidget from './components/Widget.vue'

export { RevaWidget }
