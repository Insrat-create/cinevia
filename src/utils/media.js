export function getBackgroundImageStyle(imageUrl) {
  if (!imageUrl) {
    return undefined
  }

  return {
    backgroundImage: `url(${JSON.stringify(imageUrl)})`,
  }
}
