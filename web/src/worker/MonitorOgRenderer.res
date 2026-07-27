let width = 1200
let height = 630

let background: Png.color = (7, 10, 15)
let panel: Png.color = (14, 20, 30)
let panelSoft: Png.color = (19, 28, 42)
let border: Png.color = (39, 52, 76)
let orange: Png.color = (247, 147, 26)
let orangeMuted: Png.color = (145, 87, 26)
let blue: Png.color = (88, 166, 255)
let text: Png.color = (248, 250, 252)
let muted: Png.color = (137, 148, 166)
let dim: Png.color = (78, 89, 108)

let render = async (data: Monitor.monitorData) => {
  let plan = MonitorOgImageModel.renderPlan(data)
  let raster = Png.createRaster(width, height, background)

  Png.fillRect(raster, 0, 0, width, 10, orange)
  Png.fillRect(raster, 90, 76, 1020, 478, panel)
  Png.strokeRect(raster, 90, 76, 1020, 478, border, 2)
  Png.fillRect(raster, 92, 78, 8, 474, orangeMuted)

  Png.drawText(raster, 116, 112, "BIP-110 MONITOR", 8, text)
  Png.drawText(raster, 116, 182, "SIGNALING STATUS", 5, muted)
  Png.drawText(raster, 116, 238, plan.pctLabel, 18, orange)
  Png.drawText(raster, 118, 384, "OF BLOCKS SIGNALING", 5, text)

  Png.drawText(raster, 700, 198, plan.periodLabel, 5, text)
  Png.drawText(raster, 700, 256, plan.blocksLabel, 3, muted)
  Png.drawText(raster, 700, 304, plan.tipLabel, 3, muted)
  Png.drawText(raster, 700, 352, plan.thresholdLabel, 3, muted)

  Png.fillRect(raster, 110, 462, 980, 32, panelSoft)
  Png.fillRect(raster, 110, 462, plan.signalWidth, 32, orange)
  Png.fillRect(raster, plan.thresholdX, 452, 4, 52, text)
  Png.drawText(raster, 110, 516, "0", 3, dim)
  Png.drawText(raster, plan.thresholdX - 28, 516, plan.thresholdPercentLabel, 3, muted)
  Png.drawRightText(raster, 1090, 516, "100%", 3, dim)

  Png.fillRect(raster, 110, 568, 980, 10, panelSoft)
  Png.fillRect(raster, 110, 568, plan.periodProgressWidth, 10, blue)
  Png.drawText(raster, 110, 588, plan.periodProgressLabel, 3, muted)
  Png.drawRightText(raster, 1090, 588, "BIP110.ORG/MONITOR", 3, muted)

  await Png.encodePng(raster)
}
