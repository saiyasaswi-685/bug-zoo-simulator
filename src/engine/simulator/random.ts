export const randomProvider = {
  random: (): number => Math.random(),
  selectElement: <T>(arr: T[]): T => {
    const idx = Math.floor(randomProvider.random() * arr.length);
    return arr[idx];
  }
};
