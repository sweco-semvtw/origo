import Collection from 'ol/Collection';
import Feature from 'ol/Feature';
import geom from 'ol/geom/Geometry';
import { Component } from './ui';
import Map from './map';
import proj from './projection';
import getCapabilities from './getCapabilities';
import MapSize from './utils/mapsize';
import Featureinfo from './featureinfo';
import Selectionmanager from './selectionmanager';
import maputils from './maputils';
import utils from './utils';
import Layer from './layer';
import Main from './components/main';
import Footer from './components/footer';
import flattenGroups from './utils/flattengroups';
import getcenter from './geometry/getcenter';
import isEmbedded from './utils/isembedded';
import permalink from './permalink/permalink';

const Viewer = function Viewer(targetOption, options = {}) {
  let map;
  let tileGrid;
  let featureinfo;
  let selectionmanager;

  let {
    projection,
    breakPoints,
    breakPointsPrefix,
    clsOptions = '',
    consoleId = 'o-console',
    mapCls = 'o-map',
    controls = [],
    featureinfoOptions = {},
    groups: groupOptions = [],
    pageSettings = {},
    projectionCode,
    projectionExtent,
    startExtent,
    extent = [],
    center: centerOption = [0, 0],
    zoom: zoomOption = 0,
    resolutions = null,
    layers: layerOptions = [],
    map: mapName,
    params: urlParams = {},
    proj4Defs,
    styles = {},
    source = {},
    clusterOptions = {},
    tileGridOptions = {},
    url
  } = options;

  const viewerOptions = Object.assign({}, options);
  const target = targetOption;
  const center = urlParams.center || centerOption;
  const zoom = urlParams.zoom || zoomOption;
  const groups = flattenGroups(groupOptions);
  const layerStylePicker = {};

  const getCapabilitiesLayers = () => {
    const capabilitiesPromises = [];
    (Object.keys(source)).forEach(sourceName => {
      const sourceOptions = source[sourceName];
      if (sourceOptions && sourceOptions.capabilitiesURL) {
        capabilitiesPromises.push(getCapabilities(sourceName, sourceOptions.capabilitiesURL));
      }
    });
    return Promise.all(capabilitiesPromises).then(capabilitiesResults => {
      const layers = {};
      capabilitiesResults.forEach(result => {
        layers[result.name] = result.capabilites;
      });
      return layers;
    }).catch(error => console.log(error));
  };

  const defaultTileGridOptions = {
    alignBottomLeft: true,
    extent,
    resolutions,
    tileSize: [256, 256]
  };
  const tileGridSettings = Object.assign({}, defaultTileGridOptions, tileGridOptions);
  let mapGridCls = '';
  if (pageSettings.mapGrid) {
    if (pageSettings.mapGrid.visible) {
      mapGridCls = 'o-map-grid';
    }
  }
  const cls = `${clsOptions} ${mapGridCls} ${mapCls} o-ui`.trim();
  const footerData = pageSettings.footer || {};
  const main = Main();
  const footer = Footer({
    data: footerData
  });
  let mapSize;

  const addControl = function addControl(control) {
    if (control.onAdd && control.dispatch) {
      if (!control.options.hideWhenEmbedded || !isEmbedded(this.getTarget())) {
        this.addComponent(control);
      }
    } else {
      throw new Error('Valid control must have onAdd and dispatch methods');
    }
  };

  const addControls = function addControls() {
    controls.forEach((control) => {
      this.addControl(control);
    });
  };

  const getExtent = () => extent;

  const getBreakPoints = function getBreakPoints(size) {
    return size && size in breakPoints ? breakPoints[size] : breakPoints;
  };

  const getFeatureinfo = () => featureinfo;

  const getSelectionManager = () => selectionmanager;

  const getCenter = () => getcenter;

  const getMapUtils = () => maputils;

  const getUtils = () => utils;

  const getMapName = () => mapName;

  const getTileGrid = () => tileGrid;

  const getTileGridSettings = () => tileGridSettings;

  const getTileSize = () => tileGridSettings.tileSize;

  const getViewerOptions = () => viewerOptions;

  const getUrl = () => url;

  const getStyle = (styleName) => {
    if (styleName in styles) {
      return styles[styleName];
    }
    return null;
  };

  const setStyle = (styleName, style) => {
    if (styleName in styles) {
      styles[styleName] = style;
    }
  };

  const getStyles = () => styles;

  const getResolutions = () => resolutions;

  const getMapUrl = () => {
    let layerNames = '';
    let mapUrl;

    // delete search arguments if present
    if (window.location.search) {
      mapUrl = window.location.href.replace(window.location.search, '?');
    } else {
      mapUrl = `${window.location.href}?`;
    }
    const mapView = map.getView();
    const centerCoords = mapView.getCenter().map(coord => parseInt(coord, 10));
    const zoomLevel = mapView.getZoom();
    const layers = map.getLayers();

    // add layer if visible
    layers.forEach((el) => {
      if (el.getVisible() === true) {
        layerNames += `${el.get('name')};`;
      } else if (el.get('legend') === true) {
        layerNames += `${el.get('name')},1;`;
      }
    });
    return `${mapUrl}${centerCoords}&${zoomLevel}&${layerNames.slice(0, layerNames.lastIndexOf(';'))}`;
  };

  const getMap = () => map;

  const getLayers = () => map.getLayers().getArray();

  const getLayersByProperty = function getLayersByProperty(key, val, byName) {
    const layers = map.getLayers().getArray().filter(layer => layer.get(key) && layer.get(key) === val);

    if (byName) {
      return layers.map(layer => layer.get('name'));
    }
    return layers;
  };

  const getLayer = function getLayer(layerName) {
    const layerArray = getLayers();
    if (layerArray.some(layer => layer.get('name') === layerName)) {
      return layerArray.find(layer => layer.get('name') === layerName);
    } else if (layerArray.some(layer => layer.get('type') === 'GROUP')) {
      const groupLayerArray = layerArray.filter(layer => layer.get('type') === 'GROUP');
      const layersFromGroupLayersArray = groupLayerArray.map(groupLayer => groupLayer.getLayers().getArray());
      return layersFromGroupLayersArray.flat().find(layer => layer.get('name') === layerName);
    }
    return undefined;
  };

  const getQueryableLayers = function getQueryableLayers() {
    const queryableLayers = getLayers().filter(layer => layer.get('queryable') && layer.getVisible());
    return queryableLayers;
  };

  const getGroupLayers = function getGroupLayers() {
    const groupLayers = getLayers().filter(layer => layer.get('type') === 'GROUP');
    return groupLayers;
  };

  const getSearchableLayers = function getSearchableLayers(searchableDefault) {
    const searchableLayers = [];
    map.getLayers().forEach((layer) => {
      let searchable = layer.get('searchable');
      const visible = layer.getVisible();
      searchable = searchable === undefined ? searchableDefault : searchable;
      if (searchable === 'always' || (searchable && visible)) {
        searchableLayers.push(layer.get('name'));
      }
    });
    return searchableLayers;
  };

  const getGroup = function getGroup(groupName) {
    return groups.find(group => group.name === groupName);
  };

  const getSource = function getSource(name) {
    if (name in source) {
      return source[name];
    }
    throw new Error(`There is no source with name: ${name}`);
  };

  const getSource2 = function getSource2(name) {
    if (name in source) {
      return source[name];
    }
    return undefined;
  };

  const getGroups = () => groups;

  const getProjectionCode = () => projectionCode;

  const getProjection = () => projection;

  const getMapSource = () => source;

  const getControlByName = function getControlByName(name) {
    const components = this.getComponents();
    const control = components.find(component => component.name === name);
    if (!control) {
      return null;
    }
    return control;
  };

  const getSize = function getSize() {
    return mapSize.getSize();
  };

  const getTarget = () => target;

  const getClusterOptions = () => clusterOptions;

  const getConsoleId = () => consoleId;

  const getInitialZoom = () => zoom;

  const getFooter = () => footer;

  const getMain = () => main;

  const getEmbedded = function getEmbedded() {
    return isEmbedded(this.getTarget());
  };

  const mergeSecuredLayer = (layerlist, capabilitiesLayers) => {
    if (capabilitiesLayers && Object.keys(capabilitiesLayers).length > 0) {
      return layerlist.map(layer => {
        let secure;
        let layername = layer.name;
        // remove workspace if syntax is workspace:layername
        layername = layername.split(':').pop();
        // remove double underscore plus a suffix from layer name
        if (layername.includes('__')) {
          layername = layername.substring(0, layername.lastIndexOf('__'));
        }
        const layerSourceOptions = layer.source ? getSource2(layer.source) : undefined;
        if (layerSourceOptions && layerSourceOptions.capabilitiesURL) {
          if (capabilitiesLayers[layer.source].indexOf(layername) >= 0) {
            secure = false;
          } else {
            secure = true;
          }
        } else {
          secure = false;
        }
        return { ...layer, secure };
      });
    }
    return layerlist;
  };

  const mergeSavedLayerProps = (initialLayerProps, savedLayerProps) => getCapabilitiesLayers()
    .then(capabilitiesLayers => {
      let mergedLayerProps;
      if (savedLayerProps) {
        mergedLayerProps = initialLayerProps.reduce((acc, initialProps) => {
          const layerName = initialProps.name.split(':').pop();
          const savedProps = savedLayerProps[layerName] || {
            visible: false,
            legend: false
          };
          // Apply changed style
          if (savedLayerProps[layerName] && savedLayerProps[layerName].altStyleIndex > -1) {
            const altStyle = initialProps.stylePicker[savedLayerProps[layerName].altStyleIndex];
            savedProps.clusterStyle = altStyle.clusterStyle;
            savedProps.style = altStyle.style;
            savedProps.defaultStyle = initialProps.style;
          }
          savedProps.name = initialProps.name;
          const mergedProps = Object.assign({}, initialProps, savedProps);
          acc.push(mergedProps);
          return acc;
        }, []);
        return mergeSecuredLayer(mergedLayerProps, capabilitiesLayers);
      }
      return mergeSecuredLayer(initialLayerProps, capabilitiesLayers);
    });

  const removeOverlays = function removeOverlays(overlays) {
    if (overlays) {
      if (overlays.constructor === Array || overlays instanceof Collection) {
        overlays.forEach((overlay) => {
          map.removeOverlay(overlay);
        });
      } else {
        map.removeOverlay(overlays);
      }
    } else {
      map.getOverlays().clear();
    }
  };

  const setMap = function setMap(newMap) {
    map = newMap;
  };

  const setProjection = function setProjection(newProjection) {
    projection = newProjection;
  };

  const zoomToExtent = function zoomToExtent(geometry, level) {
    const view = map.getView();
    const maxZoom = level;
    const geometryExtent = geometry.getExtent();
    if (geometryExtent) {
      view.fit(geometryExtent, {
        maxZoom
      });
      return geometryExtent;
    }
    return false;
  };

  const getLayerStylePicker = function getLayerStylePicker(layer) {
    return layerStylePicker[layer.get('name')] || [];
  };

  const addLayerStylePicker = function addLayerStylePicker(layerProps) {
    if (!layerStylePicker[layerProps.name]) {
      layerStylePicker[layerProps.name] = layerProps.stylePicker;
    }
  };

  const addLayer = function addLayer(layerProps) {
    const layer = Layer(layerProps, this);
    addLayerStylePicker(layerProps);
    map.addLayer(layer);
    this.dispatch('addlayer', {
      layerName: layerProps.name
    });
  };

  const addLayers = function addLayers(layersProps) {
    layersProps.reverse().forEach((layerProps) => {
      this.addLayer(layerProps);
    });
  };

  const addGroup = function addGroup(groupProps) {
    const defaultProps = {
      type: 'group'
    };
    const groupDef = Object.assign({}, defaultProps, groupProps);
    const name = groupDef.name;
    if (!(groups.filter(group => group.name === name).length)) {
      groups.push(groupDef);
      this.dispatch('add:group', {
        group: groupDef
      });
    }
  };

  const addGroups = function addGroups(groupsProps) {
    groupsProps.forEach((groupProps) => {
      this.addGroup(groupProps);
    });
  };

  // removes group and any depending subgroups and layers
  const removeGroup = function removeGroup(groupName) {
    const group = groups.find(item => item.name === groupName);
    if (group) {
      const layers = getLayersByProperty('group', groupName);
      layers.forEach((layer) => {
        map.removeLayer(layer);
      });
      const groupIndex = groups.indexOf(group);
      groups.splice(groupIndex, 1);
      this.dispatch('remove:group', {
        group
      });
    }
    const subgroups = groups.filter((item) => {
      if (item.parent) {
        return item.parent === groupName;
      }
      return false;
    });
    if (subgroups.length) {
      subgroups.forEach((subgroup) => {
        const name = subgroup.name;
        removeGroup(groups[name]);
      });
    }
  };

  const addSource = function addSource(sourceName, sourceProps) {
    if (!(sourceName in source)) {
      source[sourceName] = sourceProps;
    }
  };

  const addStyle = function addStyle(styleName, styleProps) {
    if (!(styleName in styles)) {
      styles[styleName] = styleProps;
    }
  };

  const addMarker = function addMarker(coordinates, title, content) {
    const layer = maputils.createMarker(coordinates, title, content, this);
    map.addLayer(layer);
  };

  const getUrlParams = function getUrlParams() {
    return urlParams;
  };

  return Component({
    onInit() {
      this.render();

      proj.registerProjections(proj4Defs);
      setProjection(proj.Projection({
        projectionCode,
        projectionExtent
      }));

      tileGrid = maputils.tileGrid(tileGridSettings);

      setMap(Map(Object.assign(options, { projection, center, zoom, target: this.getId() })));

      mergeSavedLayerProps(layerOptions, urlParams.layers)
        .then(layerProps => {
          this.addLayers(layerProps);

          mapSize = MapSize(map, {
            breakPoints,
            breakPointsPrefix,
            mapId: this.getId()
          });

          if (urlParams.feature) {
            const featureId = urlParams.feature;
            const layerName = featureId.split('.')[0];
            const layer = getLayer(layerName);
            const layerType = layer.get('type');
            if (layer && layerType !== 'GROUP') {
              // FIXME: postrender event is only emitted if any features from a layer is actually drawn, which means there is no feature in the default extent,
              // it will not be triggered until map is panned or zoomed where a feature exists.
              layer.once('postrender', () => {
                const clusterSource = layer.getSource().source;
                // Assume that id is just the second part of the argumment and adjust it for special cases later.
                let id = featureId.split('.')[1];
                let feature;

                if (layerType === 'WFS') {
                  // WFS uses the layername as a part of the featureId. Problem is that it what the server think is the name that matters.
                  // First we assume that the layername is actually correct, then take the special cases
                  let idLayerPart = layerName;
                  const layerId = layer.get('id');
                  if (layerId) {
                    // if layer explicitly has set the id it takes precedense over name
                    // layer name already have popped the namespace part, but id is untouched.
                    idLayerPart = layerId.split(':').pop();
                  } else if (layerName.includes('__')) {
                    // If using the __-notation to use same layer several times, we must only use the actual layer name
                    idLayerPart = layerName.split('__')[0];
                  }
                  // Build the correct WFS id
                  id = `${idLayerPart}.${id}`;
                }
                // FIXME: ensure that feature is loaded. If using bbox and feature is outside default extent it will not be found.
                // Workaround is to have a default extent covering the entire map with the layer in visible range or use strategy all
                if (clusterSource) {
                  feature = clusterSource.getFeatureById(id);
                } else {
                  feature = layer.getSource().getFeatureById(id);
                }

                if (feature) {
                  const obj = {};
                  obj.feature = feature;
                  obj.layerName = layerName;
                  featureinfo.showFeatureInfo(obj);
                  map.getView().fit(feature.getGeometry(), {
                    maxZoom: getResolutions().length - 2,
                    padding: [15, 15, 40, 15],
                    duration: 1000
                  });
                }
              });
            }
          }

          if (urlParams.pin) {
            featureinfoOptions.savedPin = urlParams.pin;
          } else if (urlParams.selection) {
            // This needs further development for proper handling in permalink
            featureinfoOptions.savedSelection = new Feature({
              geometry: new geom[urlParams.selection.geometryType](urlParams.selection.coordinates)
            });
          }

          if (!urlParams.zoom && !urlParams.mapStateId && startExtent) {
            map.getView().fit(startExtent, { size: map.getSize() });
          }

          featureinfoOptions.viewer = this;

          selectionmanager = Selectionmanager(featureinfoOptions);
          featureinfo = Featureinfo(featureinfoOptions);
          this.addComponent(selectionmanager);
          this.addComponent(featureinfo);

          this.addControls();
          this.dispatch('loaded');
        });
    },
    render() {
      const htmlString = `<div id="${this.getId()}" class="${cls}">
                            <div class="transparent flex column height-full width-full absolute top-left no-margin z-index-low">
                              ${main.render()}
                              ${footer.render()}
                            </div>
                          </div>
                              
                          <div id="loading" class="hide">
                            <div class="loading-spinner"></div>
                          </div>`;
      const el = document.querySelector(target);
      el.innerHTML = htmlString;
      this.dispatch('render');
    },
    addControl,
    addControls,
    addGroup,
    addGroups,
    addLayer,
    addLayers,
    addSource,
    addStyle,
    addMarker,
    getBreakPoints,
    getCenter,
    getClusterOptions,
    getConsoleId,
    getControlByName,
    getExtent,
    getFeatureinfo,
    getFooter,
    getInitialZoom,
    getTileGridSettings,
    getGroup,
    getGroups,
    getMain,
    getMapSource,
    getMapUtils,
    getUtils,
    getQueryableLayers,
    getGroupLayers,
    getResolutions,
    getSearchableLayers,
    getSize,
    getLayer,
    getLayerStylePicker,
    getLayers,
    getLayersByProperty,
    getMap,
    getMapName,
    getMapUrl,
    getProjection,
    getProjectionCode,
    getSource,
    getStyle,
    getStyles,
    getTarget,
    getTileGrid,
    getTileSize,
    getUrl,
    getUrlParams,
    getViewerOptions,
    removeGroup,
    removeOverlays,
    setStyle,
    zoomToExtent,
    getSelectionManager,
    getEmbedded,
    permalink
  });
};

export default Viewer;
