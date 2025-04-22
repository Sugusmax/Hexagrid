import React, { useEffect, useState } from 'react';
import {
  View,
  Image,
  Dimensions,
  StyleSheet,
  TextInput,
  Modal,
  Text,
  TouchableOpacity,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import {
  GestureHandlerRootView,
  PanGestureHandler,
} from 'react-native-gesture-handler';
import MaskedView from '@react-native-masked-view/masked-view';
import { Asset } from 'expo-asset';
import { Ionicons } from '@expo/vector-icons';

const HEX_SIZE = 50;
const SPACING = 2;

const window = Dimensions.get('window');
const HEX_WIDTH = Math.sqrt(3) * (HEX_SIZE + SPACING);
const HEX_HEIGHT = (HEX_SIZE + SPACING) * 1.5;

const dynamicRenderRadius =
  Math.ceil(Math.max(window.width / HEX_WIDTH, window.height / HEX_HEIGHT)) + 2;

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
  const [screen, setScreen] = useState('menu');
  const [hexagons, setHexagons] = useState([]);
  const [hexImage, setHexImage] = useState(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [texts, setTexts] = useState({});
  const [images, setImages] = useState({});
  const [selected, setSelected] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalText, setModalText] = useState('');
  const [gestureOffset, setGestureOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    Asset.loadAsync(require('./assets/hexagon.png')).then(([asset]) =>
      setHexImage({ uri: asset.uri })
    );
  }, []);

  const startNewGrid = () => {
    const center = { x: window.width / 2, y: window.height / 2 };
    setHexagons(generateHexGrid(dynamicRenderRadius));
    setTexts({});
    setImages({});
    setOffset(center);
    setGestureOffset(center);
    setScreen('editor');
  };

  const loadGridFromFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
    });
    if (!result.canceled) {
      try {
        const content = await FileSystem.readAsStringAsync(
          result.assets[0].uri
        );
        const data = JSON.parse(content);
        setHexagons(data.hexagons || []);
        setTexts(data.texts || {});
        setImages(data.images || {});
        const center = { x: window.width / 2, y: window.height / 2 };
        setOffset(center);
        setGestureOffset(center);
        setScreen('editor');
      } catch (e) {
        Alert.alert('Error', 'No se pudo cargar el archivo.');
      }
    }
  };

  // Función corregida para guardar el grid con imágenes y textos
  const saveGridToFile = async () => {
    try {
      const data = {
        hexagons, // Información de los hexágonos
        texts,    // Textos de los hexágonos
        images,   // Imágenes de los hexágonos
      };

      const fileUri =
        FileSystem.documentDirectory + 'hexagrid_' + Date.now() + '.json';
        
      // Guardamos el archivo en el directorio de la app
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(data));
      
      // Alerta de éxito
      Alert.alert('Guardado', 'Archivo guardado correctamente en:\n' + fileUri);
    } catch (error) {
      // Manejo de errores
      console.error('Error al guardar el archivo', error);
      Alert.alert('Error', 'Hubo un problema al guardar el archivo.');
    }
  };

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
      setImages((prev) => ({ ...prev, [selected]: uri }));
    }
  };

  const handleRemoveImage = () => {
    if (selected) {
      setImages((prev) => {
        const newImages = { ...prev };
        delete newImages[selected];
        return newImages;
      });
    }
  };

  const handleSave = () => {
    if (selected) {
      setTexts((prev) => ({ ...prev, [selected]: modalText }));
      setModalVisible(false);
    }
  };

  const onGestureEvent = (event) => {
    const { translationX, translationY } = event.nativeEvent;
    setOffset({
      x: gestureOffset.x + translationX,
      y: gestureOffset.y + translationY,
    });
  };

  const onGestureEnd = (event) => {
    const { translationX, translationY } = event.nativeEvent;
    setGestureOffset((prev) => ({
      x: prev.x + translationX,
      y: prev.y + translationY,
    }));
  };

  if (screen === 'menu') {
    return (
      <View style={styles.menuContainer}>
        <TouchableOpacity style={styles.menuButton} onPress={startNewGrid}>
          <Text style={styles.menuText}>Nuevo Hexagrid</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuButton} onPress={loadGridFromFile}>
          <Text style={styles.menuText}>Cargar Hexagrid</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PanGestureHandler onGestureEvent={onGestureEvent} onEnded={onGestureEnd}>
        <View style={styles.container}>
          <TouchableOpacity style={styles.saveIcon} onPress={saveGridToFile}>
            <Ionicons name="save" size={28} color="white" />
          </TouchableOpacity>
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
                <Text style={styles.label}>Descripción:</Text>
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
                    <TouchableOpacity
                      onPress={handleRemoveImage}
                      style={styles.removeButton}>
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
                <TouchableOpacity
                  onPress={handleSave}
                  style={styles.saveButton}>
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
  saveIcon: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
  },
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
  menuContainer: {
    flex: 1,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuButton: {
    backgroundColor: '#333',
    padding: 20,
    borderRadius: 12,
    marginVertical: 10,
  },
  menuText: {
    color: '#fff',
    fontSize: 18,
  },
});