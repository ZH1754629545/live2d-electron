<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps({
  filter: {
    dates:[],
    type: Object,
    required: true
  },
  sort: {
    type: String,
    required: true
  }
});

const emit = defineEmits(['close', 'apply']);

const currentFilter = ref({
  dates: Array.isArray(props.filter.dates) ? [...props.filter.dates] : [],
  importance: props.filter.importance||0
});

const currentSort = ref(props.sort);
const showDialog = ref(true); // Add this line to control dialog visibility

// 应用设置
const applySettings = () => {
  emit('apply', {...currentFilter.value}, currentSort.value);
};

// 关闭设置
const closeSettings = () => {
  showDialog.value = false; // Update this line
  emit('close');
};

// 增加重要度
const increaseImportance = () => {
  if (currentFilter.value.importance < 5) {
    currentFilter.value.importance++;
  }
};

// 减少重要度
const decreaseImportance = () => {
  if (currentFilter.value.importance > 0) {
    currentFilter.value.importance--;
  }
};
</script>

<template>
  <q-dialog v-model="showDialog" persistent>
    <q-card style="min-width: 350px">
      <q-card-section class="row items-center">
        <div class="text-h6">设置</div>
        <q-space />
        <q-btn icon="close" flat round dense @click="closeSettings" />
      </q-card-section>

      <q-card-section>
        <div class="text-subtitle1 q-mb-sm">筛选</div>
        
        <div class="q-mb-md">
          <div class="row items-center">
            <div class="col-4">日期筛选:</div>
            <div class="col-8">
              <q-input 
                v-model="currentFilter.dates" 
                label="选择日期" 
                outlined
              >
                <template v-slot:append>
                  <q-icon name="event" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-date 
                        v-model="currentFilter.dates" 
                        multiple 
                      />
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </div>
        </div>
        
        <div class="q-mb-md">
          <div class="row items-center">
            <div class="col-4">重要度筛选:</div>
            <div class="col-8">
              <div class="row items-center">
                <q-btn icon="remove" flat round dense @click="decreaseImportance" />
                <div class="q-mx-md">{{ currentFilter.importance }}</div>
                <q-btn icon="add" flat round dense @click="increaseImportance" />
              </div>
            </div>
          </div>
        </div>
        
        <div class="text-subtitle1 q-mb-sm">排序</div>
        
        <div class="q-mb-md">
          <q-select
            v-model="currentSort"
            :options="[
              { label: '按创建时间排序', value: 'createTime' },
              { label: '按重要度排序', value: 'importance' },
              { label: '按截止时间排序', value: 'dueTime' }
            ]"
            option-label="label"
            option-value="value"
            map-options
            emit-value
            outlined
          />
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="取消" color="primary" @click="closeSettings" />
        <q-btn flat label="应用" color="primary" @click="applySettings" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>