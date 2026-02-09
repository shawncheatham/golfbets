import { extendTheme, type ThemeConfig } from '@chakra-ui/react'
import type { StyleFunctionProps } from '@chakra-ui/theme-tools'

const config: ThemeConfig = {
  initialColorMode: 'light',
  useSystemColorMode: false,
}

// Slightly less saturated “iOS-ish” green.
const accent = {
  50: '#E8F5EF',
  100: '#CFEBDD',
  200: '#A8D8C2',
  300: '#7FC4A6',
  400: '#59B18B',
  500: '#3C9A72',
  600: '#2F7D5B',
  700: '#266348',
  800: '#1E4D38',
  900: '#163728',
}

export const theme = extendTheme({
  config,
  colors: {
    accent,
  },
  styles: {
    global: (props: StyleFunctionProps) => ({
      body: {
        bg: props.colorMode === 'dark' ? 'gray.950' : 'gray.50',
        color: props.colorMode === 'dark' ? 'gray.100' : 'gray.900',
      },
    }),
  },
  fonts: {
    heading:
      '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", system-ui, sans-serif',
    body: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif',
  },
  radii: {
    md: '12px',
    lg: '16px',
    xl: '20px',
  },
  shadows: {
    outline: '0 0 0 3px rgba(60, 154, 114, 0.35)',
  },
  components: {
    Button: {
      baseStyle: {
        borderRadius: '14px',
        fontWeight: 600,
      },
      sizes: {
        md: {
          h: '44px',
          px: '18px',
          fontSize: 'md',
        },
        sm: {
          h: '36px',
          px: '14px',
          fontSize: 'sm',
        },
      },
      variants: {
        primary: (props: StyleFunctionProps) => ({
          bg: props.colorMode === 'dark' ? 'accent.500' : 'accent.500',
          color: 'white',
          _hover: { bg: 'accent.600' },
          _active: { bg: 'accent.700', transform: 'translateY(1px)' },
        }),
        secondary: (props: StyleFunctionProps) => ({
          bg: props.colorMode === 'dark' ? 'whiteAlpha.100' : 'blackAlpha.50',
          color: props.colorMode === 'dark' ? 'gray.100' : 'gray.900',
          _hover: {
            bg: props.colorMode === 'dark' ? 'whiteAlpha.200' : 'blackAlpha.100',
          },
          _active: {
            bg: props.colorMode === 'dark' ? 'whiteAlpha.300' : 'blackAlpha.200',
            transform: 'translateY(1px)',
          },
        }),
        tertiary: (props: StyleFunctionProps) => ({
          bg: 'transparent',
          borderWidth: '1px',
          borderColor: props.colorMode === 'dark' ? 'whiteAlpha.300' : 'blackAlpha.200',
          color: props.colorMode === 'dark' ? 'gray.100' : 'gray.900',
          _hover: { bg: props.colorMode === 'dark' ? 'whiteAlpha.100' : 'blackAlpha.50' },
          _active: { transform: 'translateY(1px)' },
        }),
      },
      defaultProps: {
        size: 'md',
      },
    },
    Input: {
      defaultProps: {
        size: 'md',
        variant: 'filled',
      },
      variants: {
        filled: (props: StyleFunctionProps) => ({
          field: {
            borderRadius: '14px',
            bg: props.colorMode === 'dark' ? 'whiteAlpha.50' : 'blackAlpha.50',
            borderWidth: '1px',
            borderColor: props.colorMode === 'dark' ? 'whiteAlpha.200' : 'blackAlpha.100',
            _hover: {
              bg: props.colorMode === 'dark' ? 'whiteAlpha.100' : 'blackAlpha.100',
            },
            _focusVisible: {
              boxShadow: 'outline',
              borderColor: 'accent.500',
            },
          },
        }),
      },
    },
    Textarea: {
      defaultProps: {
        size: 'md',
        variant: 'filled',
      },
      variants: {
        filled: (props: StyleFunctionProps) => ({
          borderRadius: '14px',
          bg: props.colorMode === 'dark' ? 'whiteAlpha.50' : 'blackAlpha.50',
          borderWidth: '1px',
          borderColor: props.colorMode === 'dark' ? 'whiteAlpha.200' : 'blackAlpha.100',
          _hover: {
            bg: props.colorMode === 'dark' ? 'whiteAlpha.100' : 'blackAlpha.100',
          },
          _focusVisible: {
            boxShadow: 'outline',
            borderColor: 'accent.500',
          },
        }),
      },
    },
    Table: {
      baseStyle: {
        th: {
          textTransform: 'none',
          letterSpacing: 'normal',
          fontWeight: 700,
          fontSize: 'sm',
        },
      },
    },
    Card: {
      baseStyle: (props: StyleFunctionProps) => ({
        container: {
          borderRadius: '20px',
          borderWidth: '1px',
          borderColor: props.colorMode === 'dark' ? 'whiteAlpha.200' : 'blackAlpha.100',
          bg: props.colorMode === 'dark' ? 'whiteAlpha.50' : 'white',
          boxShadow: props.colorMode === 'dark' ? 'none' : 'sm',
        },
      }),
    },
  },
})
