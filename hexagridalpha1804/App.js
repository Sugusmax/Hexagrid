import React, { useState, useEffect } from 'react';
import {
  View,
  Image,
  Dimensions,
  StyleSheet,
  TextInput,
  Modal,
  Text,
  TouchableOpacity,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { GestureHandlerRootView, PanGestureHandler } from 'react-native-gesture-handler';
import MaskedView from '@react-native-masked-view/masked-view';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';

const saveGridToFile = async () => {
  const data = { hexagons, texts, images }; // Los datos actuales del estado
  const fileUri = FileSystem.documentDirectory + 'gridData.json';

  try {
    await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(data));
    Alert.alert('Éxito', 'Datos guardados en gridData.json');
  } catch (error) {
    Alert.alert('Error', 'No se pudo guardar el archivo: ' + error.message);
  }
};
const loadGridFromFile = async () => {
  const fileUri = FileSystem.documentDirectory + 'gridData.json';

  try {
    const fileContents = await FileSystem.readAsStringAsync(fileUri);
    const data = JSON.parse(fileContents);

    setHexagons(data.hexagons || []); // Actualiza los hexágonos
    setTexts(data.texts || {});       // Actualiza los textos
    setImages(data.images || {});     // Actualiza las imágenes
    Alert.alert('Éxito', 'Datos cargados desde gridData.json');
  } catch (error) {
    Alert.alert('Error', 'No se pudo cargar el archivo: ' + error.message);
  }
};
const HEX_SIZE = 50;
const SPACING = 2;
const window = Dimensions.get('window');
const HEX_WIDTH = Math.sqrt(3) * (HEX_SIZE + SPACING);
const HEX_HEIGHT = (HEX_SIZE + SPACING) * 1.5;
const dynamicRenderRadius = Math.ceil(Math.max(window.width / HEX_WIDTH, window.height / HEX_HEIGHT)) + 2;

function axialToPixel(q, r) {
  const x = HEX_WIDTH * (q + r / 2);
  const y = HEX_HEIGHT * r;
  return { x, y };
}

function generateHexGrid(radius) {
  const hexes = [];
  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min(radius, -q + radius);
    for (let r = r1; r <= r2; r++) {
      hexes.push({ q, r });
    }
  }
  return hexes;
}

export default function App() {
  const [hexagons, setHexagons] = useState([]);
  const [hexImage, setHexImage] = useState(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [gestureOffset, setGestureOffset] = useState({ x: 0, y: 0 });
  const [texts, setTexts] = useState({});
  const [images, setImages] = useState({});
  const [selected, setSelected] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalText, setModalText] = useState('');
  // bounds para el paneo
  const [bounds, setBounds] = useState({ minX: 0, maxX: 0, minY: 0, maxY: 0 });
  const [menuVisible, setMenuVisible] = useState(false);

  useEffect(() => {
    // generamos grid y cargamos la imagen
    setHexagons(generateHexGrid(dynamicRenderRadius));
    setHexImage(require('./assets/hexagon.png'));
  }, []);

  // calculamos los límites basados en parcelas del grid
  useEffect(() => {
    if (hexagons.length === 0) return;
    const pixels = hexagons.map(({ q, r }) => axialToPixel(q, r));
    const xVals = pixels.map(p => p.x);
    const yVals = pixels.map(p => p.y);
    const xMin = Math.min(...xVals);
    const xMax = Math.max(...xVals);
    const yMin = Math.min(...yVals);
    const yMax = Math.max(...yVals);

    const minX = window.width - (xMax + HEX_SIZE);
    const maxX = -(xMin - HEX_SIZE);
    const minY = window.height - (yMax + HEX_SIZE);
    const maxY = -(yMin - HEX_SIZE);

    setBounds({ minX, maxX, minY, maxY });
  }, [hexagons]);

  const handleHexPress = (q, r) => {
    const key = `${q},${r}`;
    setSelected(key);
    setModalText(texts[key] || '');
    setModalVisible(true);
  };

  const handleImagePick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled && selected) {
      const uri = result.assets[0].uri;
      setImages(prev => ({ ...prev, [selected]: uri }));
    }
  };

  const handleRemoveImage = () => {
    if (selected) {
      setImages(prev => {
        const copy = { ...prev };
        delete copy[selected];
        return copy;
      });
    }
  };

  const handleSave = () => {
    if (selected) {
      setTexts(prev => ({ ...prev, [selected]: modalText }));
      setModalVisible(false);
    }
  };

  const onGestureEvent = event => {
    const { translationX, translationY } = event.nativeEvent;
    let newX = gestureOffset.x + translationX;
    let newY = gestureOffset.y + translationY;
    // aplicamos límites
    newX = Math.max(bounds.minX, Math.min(newX, bounds.maxX));
    newY = Math.max(bounds.minY, Math.min(newY, bounds.maxY));
    setOffset({ x: newX, y: newY });
  };

  const onGestureEnd = event => {
    const { translationX, translationY } = event.nativeEvent;
    let newX = gestureOffset.x + translationX;
    let newY = gestureOffset.y + translationY;
    newX = Math.max(bounds.minX, Math.min(newX, bounds.maxX));
    newY = Math.max(bounds.minY, Math.min(newY, bounds.maxY));
    setGestureOffset({ x: newX, y: newY });
  };

  const toggleMenu = () => {
    setMenuVisible(!menuVisible);
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PanGestureHandler onGestureEvent={onGestureEvent} onEnded={onGestureEnd}>
        <View style={styles.container}>
          {/* Botón de carpeta en la parte superior derecha */}
          <TouchableOpacity onPress={toggleMenu} style={styles.menuButton}>
            <Ionicons name="folder-outline" size={30} color="white" />
          </TouchableOpacity>

          {/* Aquí agregaríamos el menú, que en este momento solo muestra un aviso */}
          {menuVisible && (
  <View style={styles.menu}>
    <TouchableOpacity onPress={saveGridToFile} style={styles.menuOption}>
      <Text style={styles.menuText}>Guardar Grid</Text>
    </TouchableOpacity>
    <TouchableOpacity onPress={loadGridFromFile} style={styles.menuOption}>
      <Text style={styles.menuText}>Cargar Grid</Text>
    </TouchableOpacity>
  </View>
)}

          {hexImage &&
            hexagons.map(({ q, r }) => {
              const key = `${q},${r}`;
              const { x, y } = axialToPixel(q, r);
              const screenX = offset.x + x;
              const screenY = offset.y + y;

              if (
                screenX + HEX_SIZE < 0 ||
                screenX - HEX_SIZE > window.width ||
                screenY + HEX_SIZE < 0 ||
                screenY - HEX_SIZE > window.height
              ) {
                return null;
              }

              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => handleHexPress(q, r)}
                  activeOpacity={0.8}
                  style={{
                    position: 'absolute',
                    left: screenX - HEX_SIZE,
                    top: screenY - HEX_SIZE,
                    width: HEX_SIZE * 2,
                    height: HEX_SIZE * 2,
                  }}>
                  {images[key] ? (
                    <MaskedView
                      style={{ width: HEX_SIZE * 2, height: HEX_SIZE * 2 }}
                      maskElement={
                        <Image
                          source={hexImage}
                          style={{
                            width: HEX_SIZE * 2,
                            height: HEX_SIZE * 2,
                          }}
                        />
                      }>
                      <Image
                        source={{ uri: images[key] }}
                        style={{
                          width: HEX_SIZE * 2,
                          height: HEX_SIZE * 2,
                        }}
                        resizeMode="cover"
                      />
                    </MaskedView>
                  ) : (
                    <Image
                      source={hexImage}
                      style={{
                        width: HEX_SIZE * 2,
                        height: HEX_SIZE * 2,
                      }}
                    />
                  )}
                </TouchableOpacity>
              );
            })}

          <Modal visible={modalVisible} transparent animationType="fade">
            <View style={styles.modalContainer}>
              <View style={styles.dialog}>
                <Text style={styles.label}>Editar contenido:</Text>
                <View style={styles.imageRow}>
                  <TouchableOpacity onPress={handleImagePick}>
                    <Image
                      source={
                        selected && images[selected]
                          ? { uri: images[selected] }
                          : hexImage
                      }
                      style={styles.thumbnail}
                    />
                  </TouchableOpacity>
                  {selected && images[selected] && (
                    <TouchableOpacity onPress={handleRemoveImage} style={styles.removeButton}>
                      <Text style={styles.removeButtonText}>Eliminar</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <TextInput
                  style={styles.input}
                  value={modalText}
                  onChangeText={setModalText}
                  multiline
                />
                <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
                  <Text style={{ color: '#fff' }}>Guardar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </View>
      </PanGestureHandler>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000000aa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialog: {
    backgroundColor: '#222',
    padding: 20,
    borderRadius: 12,
    width: '80%',
  },
  label: { color: '#ccc', marginBottom: 10 },
  imageRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  thumbnail: {
    width: 50,
    height: 50,
    marginRight: 10,
    borderRadius: 6,
  },
  removeButton: {
    backgroundColor: '#e53935',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  removeButtonText: { color: '#fff', fontSize: 12 },
  input: {
    backgroundColor: '#333',
    color: '#fff',
    padding: 10,
    minHeight: 80,
    borderRadius: 8,
    textAlignVertical: 'top',
  },
  saveButton: {
    marginTop: 15,
    backgroundColor: '#4caf50',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  // Estilos para el botón de menú y el menú desplegable
  menuButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 1,
  },
  menu: {
    position: 'absolute',
    top: 60,
    right: 20,
    backgroundColor: '#333',
    padding: 10,
    borderRadius: 8,
    zIndex: 1,
  },
  menuText: {
    color: '#fff',
  },
menuOption: {
  marginBottom: 10,
},
menuText: {
  color: '#fff',
},
});