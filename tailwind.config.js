module.exports = {
    content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
    theme: {
      extend: {
        fontFamily: {
          poppins: ['Poppins', 'sans-serif'],
          inter: ['Inter', 'sans-serif'],
        },
        colors: {
          'crimson-dark': '#8B0000',
          'crimson-light': '#DC143C',
          'secondary-dark': '#1A2B4C',
          'accent-light': '#E0BBE4',
          'neutral-bg': '#F8F8F8',
          'neutral-border': '#E0E0E0',
          'neutral-text-secondary': '#A0A0A0',
          'neutral-text-primary': '#333333',
        },
      },
    },
    plugins: [],
  };

  