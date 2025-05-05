import React, { useState, useEffect } from 'react';
import {
  View, Image, Dimensions, StyleSheet, Text, TextInput, Modal, TouchableOpacity, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { GestureHandlerRootView, PanGestureHandler } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import MaskedView from '@react-native-masked-view/masked-view';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';

const HEX_SIZE = 50, SPACING = 2, window = Dimensions.get('window');
const HEX_WIDTH = Math.sqrt(3) * (HEX_SIZE + SPACING), HEX_HEIGHT = (HEX_SIZE + SPACING) * 1.5;
const RADIUS = Math.ceil(Math.max(window.width / HEX_WIDTH, window.height / HEX_HEIGHT)) + 2;

const axialToPixel = (q, r) => ({ x: HEX_WIDTH * (q + r / 2), y: HEX_HEIGHT * r });
const generateHexGrid = radius => Array.from({ length: (radius * 2 + 1) ** 2 }, (_, i) => {
  const q = i % (radius * 2 + 1) - radius, r = Math.floor(i / (radius * 2 + 1)) - radius;
  return Math.abs(q + r) <= radius ? { q, r } : null;
}).filter(Boolean);

export default function App() {
  const [hexagons, setHexagons] = useState([]), [hexImage, setHexImage] = useState(null);
  const [texts, setTexts] = useState({}), [images, setImages] = useState({});
  const [offset, setOffset] = useState({ x: 0, y: 0 }), [gestureOffset, setGestureOffset] = useState({ x: 0, y: 0 });
  const [selected, setSelected] = useState(null), [modalVisible, setModalVisible] = useState(false);
  const [modalText, setModalText] = useState(''), [menuVisible, setMenuVisible] = useState(false);
  const [bounds, setBounds] = useState({ minX: 0, maxX: 0, minY: 0, maxY: 0 });

  useEffect(() => {
    setHexagons(generateHexGrid(RADIUS)), setHexImage(require('./assets/hexagon.png'));
  }, []);

  useEffect(() => {
    if (!hexagons.length) return;
    const pixels = hexagons.map(({ q, r }) => axialToPixel(q, r));
    const xVals = pixels.map(p => p.x), yVals = pixels.map(p => p.y);
    const bounds = {
      minX: window.width - (Math.max(...xVals) + HEX_SIZE),
      maxX: -(Math.min(...xVals) - HEX_SIZE),
      minY: window.height - (Math.max(...yVals) + HEX_SIZE),
      maxY: -(Math.min(...yVals) - HEX_SIZE),
    };
    setBounds(bounds);
  }, [hexagons]);

  const saveGrid = async () => {
  try {
    const filename = `grid-${Date.now()}.json`;
    const path = FileSystem.documentDirectory + filename;
    const content = JSON.stringify({ hexagons, texts, images });
    await FileSystem.writeAsStringAsync(path, content);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(path);
    } else {
      Alert.alert('Guardado local', `Archivo guardado en:\n${path}`);
    }
  } catch (e) {
    Alert.alert('Error al guardar', e.message);
  }
};

  const loadGrid = async () => {
  try {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
    if (result.type === 'success') {
      const content = await FileSystem.readAsStringAsync(result.uri);
      const { hexagons: h, texts: t, images: i } = JSON.parse(content);
      setHexagons(h || []);
      setTexts(t || {});
      setImages(i || {});
      Alert.alert('Cargado', `Grid restaurado desde:\n${result.name}`);
    }
  } catch (e) {
    Alert.alert('Error al cargar', e.message);
  }
};

  const handleHexPress = (q, r) => (setSelected(`${q},${r}`), setModalText(texts[`${q},${r}`] || ''), setModalVisible(true));
  const handleImagePick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.7 });
    if (!result.canceled && selected) setImages(prev => ({ ...prev, [selected]: result.assets[0].uri }));
  };
  const handleRemoveImage = () => selected && setImages(prev => (delete prev[selected], { ...prev }));
  const handleSave = () => selected && (setTexts(prev => ({ ...prev, [selected]: modalText })), setModalVisible(false));

  const onGestureEvent = e => {
    const { translationX, translationY } = e.nativeEvent;
    setOffset({ x: Math.max(bounds.minX, Math.min(gestureOffset.x + translationX, bounds.maxX)), y: Math.max(bounds.minY, Math.min(gestureOffset.y + translationY, bounds.maxY)) });
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PanGestureHandler onGestureEvent={onGestureEvent} onEnded={() => setGestureOffset(offset)}>
        <View style={styles.container}>
          <TouchableOpacity onPress={() => setMenuVisible(!menuVisible)} style={styles.menuButton}>
            <Ionicons name="folder-outline" size={30} color="white" />
          </TouchableOpacity>

          {menuVisible && (
            <View style={styles.menu}>
              <TouchableOpacity onPress={saveGrid} style={styles.menuOption}>
                <Text style={styles.menuText}>Guardar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={loadGrid} style={styles.menuOption}>
                <Text style={styles.menuText}>Cargar</Text>
              </TouchableOpacity>
            </View>
          )}

          {hexImage &&
            hexagons.map(({ q, r }) => {
              const { x, y } = axialToPixel(q, r), key = `${q},${r}`;
              const screenX = offset.x + x, screenY = offset.y + y;
              if (screenX + HEX_SIZE < 0 || screenX - HEX_SIZE > window.width || screenY + HEX_SIZE < 0 || screenY - HEX_SIZE > window.height) return null;
              return (
                <TouchableOpacity key={key} onPress={() => handleHexPress(q, r)} style={{ position: 'absolute', left: screenX - HEX_SIZE, top: screenY - HEX_SIZE, width: HEX_SIZE * 2, height: HEX_SIZE * 2 }}>
                  {images[key] ? (
                    <MaskedView style={{ width: HEX_SIZE * 2, height: HEX_SIZE * 2 }} maskElement={<Image source={hexImage} style={{ width: HEX_SIZE * 2, height: HEX_SIZE * 2 }} />}>
                      <Image source={{ uri: images[key] }} style={{ width: HEX_SIZE * 2, height: HEX_SIZE * 2 }} resizeMode="cover" />
                    </MaskedView>
                  ) : (
                    <Image source={hexImage} style={{ width: HEX_SIZE * 2, height: HEX_SIZE * 2 }} />
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
                    <Image source={selected && images[selected] ? { uri: images[selected] } : hexImage} style={styles.thumbnail} />
                  </TouchableOpacity>
                  {selected && images[selected] && (
                    <TouchableOpacity onPress={handleRemoveImage} style={styles.removeButton}>
                      <Text style={styles.removeButtonText}>Eliminar</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <TextInput style={styles.input} value={modalText} onChangeText={setModalText} multiline />
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
  menuButton: { position: 'absolute', top: 60, right: 20, zIndex: 1 },
  menu: { position: 'absolute', top: 100, right: 20, backgroundColor: '#333', padding: 10, borderRadius: 8, zIndex: 1 },
  menuOption: { marginBottom: 10 },
  menuText: { color: '#fff' },
  modalContainer: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'center', alignItems: 'center' },
  dialog: { backgroundColor: '#222', padding: 20, borderRadius: 12, width: '80%' },
  label: { color: '#ccc', marginBottom: 10 },
  imageRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  thumbnail: { width: 50, height: 50, marginRight: 10, borderRadius: 6 },
  removeButton: { backgroundColor: '#e53935', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  removeButtonText: { color: '#fff', fontSize: 12 },
  input: { backgroundColor: '#333', color: '#fff', padding: 10, minHeight: 80, borderRadius: 8, textAlignVertical: 'top' },
  saveButton: { marginTop: 15, backgroundColor: '#4caf50', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
});