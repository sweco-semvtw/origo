import TileWMSSource from 'ol/source/TileWMS';
import ImageWMSSource from 'ol/source/ImageWMS';
import tile from './tile';
import maputils from '../maputils';
import image from './image';

function createTileSource(options) {
  return new TileWMSSource(({
    attributions: options.attribution,
    url: options.url,
    gutter: options.gutter,
    crossOrigin: 'anonymous',
    projection: options.projection,
    tileGrid: options.tileGrid,
    params: {
      LAYERS: options.id,
      TILED: true,
      VERSION: options.version,
      FORMAT: options.format,
      STYLES: options.style
    }
  }));
}

function createImageSource(options) {
  return new ImageWMSSource(({
    attributions: options.attribution,
    url: options.url,
    crossOrigin: 'anonymous',
    projection: options.projection,
    params: {
      LAYERS: options.id,
      VERSION: options.version,
      FORMAT: options.format,
      STYLES: options.style
    }
  }));
}

function createDefaultStyle(wmsOptions, source, viewer) {
  const maxResolution = viewer.getResolutions()[viewer.getResolutions().length - 1];
  const styleName = `${wmsOptions.name}_WMSDefault`;
  const getLegendString = source.getLegendUrl(maxResolution, wmsOptions.legendParams);
  const style = [[{
    icon: {
      src: `${getLegendString}`
    },
    extendedLegend: wmsOptions.hasThemeLegend || false
  }]];
  viewer.addStyle(styleName, style);
  return styleName;
}

const wms = function wms(layerOptions, viewer) {
  const wmsDefault = {
    featureinfoLayer: null
  };
  const sourceDefault = {
    version: '1.1.1',
    gutter: 0,
    format: 'image/png'
  };
  const wmsOptions = Object.assign(wmsDefault, layerOptions);
  const renderMode = wmsOptions.renderMode || 'tile';
  wmsOptions.name.split(':').pop();
  const sourceOptions = Object.assign(sourceDefault, viewer.getMapSource()[layerOptions.source]);
  sourceOptions.attribution = wmsOptions.attribution;
  sourceOptions.projection = viewer.getProjection();
  sourceOptions.id = wmsOptions.id;
  sourceOptions.format = wmsOptions.format ? wmsOptions.format : sourceOptions.format;
  const styleSettings = viewer.getStyle(wmsOptions.styleName);
  const wmsStyleObject = styleSettings ? styleSettings[0].find(s => s.wmsStyle) : undefined;
  sourceOptions.style = wmsStyleObject ? wmsStyleObject.wmsStyle : '';

  if (wmsOptions.tileGrid) {
    sourceOptions.tileGrid = maputils.tileGrid(wmsOptions.tileGrid);
  } else if (sourceOptions.tileGrid) {
    sourceOptions.tileGrid = maputils.tileGrid(sourceOptions.tileGrid);
  } else {
    sourceOptions.tileGrid = viewer.getTileGrid();

    if (wmsOptions.extent) {
      // FIXME: there is no "extent" property to set. Code has no effect. Probably must create a new grid from viewer.getTileGridSettings .
      sourceOptions.tileGrid.extent = wmsOptions.extent;
    }
  }

  if (renderMode === 'image') {
    const source = createImageSource(sourceOptions);
    if (wmsOptions.styleName === 'default') {
      wmsOptions.styleName = createDefaultStyle(wmsOptions, source, viewer);
      wmsOptions.style = wmsOptions.styleName;
    }
    return image(wmsOptions, source);
  }

  const source = createTileSource(sourceOptions);

  if (wmsOptions.styleName === 'default') {
    wmsOptions.styleName = createDefaultStyle(wmsOptions, source, viewer);
    wmsOptions.style = wmsOptions.styleName;
  }
  return tile(wmsOptions, source);
};

export default wms;
