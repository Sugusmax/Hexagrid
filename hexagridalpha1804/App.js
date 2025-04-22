// Archivo modificado App.js
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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const HEX_RADIUS = 50;
const SPACING = 8;

function axialToPixel(q, r) {
  const x = HEX_RADIUS * Math.sqrt(3) * (q + r / 2);
  const y = HEX_RADIUS * 1.5 * r;
  return { x, y };
}

function getNeighbors(q, r) {
  const directions = [
    [+1, 0],
    [0, +1],
    [-1, +1],
    [-1, 0],
    [0, -1],
    [+1, -1],
  ];
  return directions.map(([dq, dr]) => [q + dq, r + dr]);
}

function generateInitialGrid(radius = 1) {
  const grid = {};
  for (let q = -radius; q <= radius; q++) {
    for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
      grid[`${q},${r}`] = { text: '', image: null };
    }
  }
  return grid;
}

const HEX_IMAGE = require('./assets/hexagon.png');

export default function App() {
  const [grid, setGrid] = useState(generateInitialGrid());
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState(null);
  const [inputText, setInputText] = useState('');
  const [imageUri, setImageUri] = useState(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    loadData();
  }, []);

  const handleHexPress = (q, r) => {
    setSelectedCoords({ q, r });
    const key = `${q},${r}`;
    setInputText(grid[key]?.text || '');
    setImageUri(grid[key]?.image || null);
    setModalVisible(true);
    expandGrid(q, r);
  };

  const expandGrid = (q, r) => {
    const newGrid = { ...grid };
    getNeighbors(q, r).forEach(([nq, nr]) => {
      const key = `${nq},${nr}`;
      if (!newGrid[key]) {
        newGrid[key] = { text: '', image: null };
      }
    });
    setGrid(newGrid);
  };

  const handleSave = () => {
    if (selectedCoords) {
      const { q, r } = selectedCoords;
      const key = `${q},${r}`;
      setGrid(prev => ({
        ...prev,
        [key]: { text: inputText, image: imageUri },
      }));
    }
    setModalVisible(false);
    saveData();
  };

  const handleImagePick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
    });
    if (!result.cancelled) {
      setImageUri(result.uri);
    }
  };

  const handleRemoveImage = () => {
    setImageUri(null);
  };

  const panHandler = ({ nativeEvent }) => {
    setOffset({
      x: offset.x + nativeEvent.translationX,
      y: offset.y + nativeEvent.translationY,
    });
  };

  const saveData = async () => {
    const content = JSON.stringify(grid);
    const fileUri = FileSystem.documentDirectory + 'hexagrid_save.json';
    try {
      await FileSystem.writeAsStringAsync(fileUri, content);
      Alert.alert('Guardado', 'Datos guardados en archivo accesible.');
    } catch (error) {
      console.error('Error guardando datos:', error);
    }
  };

  const loadData = async () => {
    try {
      const fileUri = FileSystem.documentDirectory + 'hexagrid_save.json';
      const exists = await FileSystem.getInfoAsync(fileUri);
      if (exists.exists) {
        const content = await FileSystem.readAsStringAsync(fileUri);
        setGrid(JSON.parse(content));
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
    }
  };

  const exportFile = async () => {
    const content = JSON.stringify(grid, null, 2);
    const fileUri = FileSystem.documentDirectory + 'hexagrid_export.json';
    await FileSystem.writeAsStringAsync(fileUri, content);
    Alert.alert('Exportado', 'Archivo exportado a: ' + fileUri);
  };

  const importFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
    if (result.type === 'success') {
      const content = await FileSystem.readAsStringAsync(result.uri);
      setGrid(JSON.parse(content));
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PanGestureHandler onGestureEvent={panHandler}>
        <View style={styles.container}>
          {Object.entries(grid).map(([key, value]) => {
            const [q, r] = key.split(',').map(Number);
            const { x, y } = axialToPixel(q, r);
            const left = x + SCREEN_WIDTH / 2 + offset.x;
            const top = y + SCREEN_HEIGHT / 2 + offset.y;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => handleHexPress(q, r)}
                style={[styles.hexContainer, { top, left }]}
              >
                <MaskedView
                  style={styles.maskedView}
                  maskElement={<Image source={HEX_IMAGE} style={styles.hexImage} />}
                >
                  <View style={styles.hexContent}>
                    {value.image && (
                      <Image source={{ uri: value.image }} style={styles.innerImage} />
                    )}
                  </View>
                </MaskedView>
              </TouchableOpacity>
            );
          })}
          <View style={styles.bottomBar}>
            <TouchableOpacity onPress={exportFile} style={styles.actionButton}>
              <Text style={styles.actionText}>Exportar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={importFile} style={styles.actionButton}>
              <Text style={styles.actionText}>Importar</Text>
            </TouchableOpacity>
          </View>
          <Modal visible={modalVisible} transparent animationType="slide">
            <View style={styles.modalContainer}>
              <View style={styles.modalContent}>
                <TextInput
                  style={styles.input}
                  placeholder="Escribe algo..."
                  value={inputText}
                  onChangeText={setInputText}
                />
                {imageUri && (
                  <Image source={{ uri: imageUri }} style={styles.previewImage} />
                )}
                <View style={styles.modalButtons}>
                  <TouchableOpacity onPress={handleImagePick} style={styles.modalButton}>
                    <Ionicons name="image-outline" size={24} color="#fff" />
                  </TouchableOpacity>
                  {imageUri && (
                    <TouchableOpacity onPress={handleRemoveImage} style={styles.modalButton}>
                      <Ionicons name="trash-outline" size={24} color="#fff" />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={handleSave} style={styles.modalButton}>
                    <Ionicons name="checkmark" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>
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
  hexContainer: {
    position: 'absolute',
    width: HEX_RADIUS * 2 + SPACING,
    height: HEX_RADIUS * 2 + SPACING,
    justifyContent: 'center',
    alignItems: 'center',
  },
  maskedView: {
    width: HEX_RADIUS * 2,
    height: HEX_RADIUS * 2,
  },
  hexImage: {
    width: HEX_RADIUS * 2,
    height: HEX_RADIUS * 2,
    resizeMode: 'contain',
  },
  hexContent: {
    flex: 1,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerImage: {
    width: HEX_RADIUS,
    height: HEX_RADIUS,
    resizeMode: 'cover',
    borderRadius: 10,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },
  actionButton: {
    backgroundColor: '#333',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  actionText: {
    color: '#fff',
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    backgroundColor: '#222',
    padding: 20,
    borderRadius: 10,
  },
  input: {
    backgroundColor: '#333',
    color: '#fff',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  previewImage: {
    width: 100,
    height: 100,
    marginBottom: 10,
    alignSelf: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  modalButton: {
    backgroundColor: '#444',
    padding: 10,
    borderRadius: 8,
  },
});