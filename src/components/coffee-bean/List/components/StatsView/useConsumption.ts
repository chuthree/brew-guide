import { useState, useEffect } from 'react';
import { ExtendedCoffeeBean } from '../../types';
import { TodayConsumptionData } from './types';

export const useConsumption = (
  beans: ExtendedCoffeeBean[]
): TodayConsumptionData => {
  const [todayConsumption, setTodayConsumption] = useState(0);
  const [todayCost, setTodayCost] = useState(0);
  const [todayEspressoConsumption, setTodayEspressoConsumption] = useState(0);
  const [todayEspressoCost, setTodayEspressoCost] = useState(0);
  const [todayFilterConsumption, setTodayFilterConsumption] = useState(0);
  const [todayFilterCost, setTodayFilterCost] = useState(0);
  const [todayOmniConsumption, setTodayOmniConsumption] = useState(0);
  const [todayOmniCost, setTodayOmniCost] = useState(0);

  // 加载今日消耗数据
  useEffect(() => {
    const loadTodayConsumption = async () => {
      try {
        // 获取所有冲煮记录
        const { Storage } = await import('@/lib/core/storage');
        const notesStr = await Storage.get('brewingNotes');
        if (!notesStr) return;

        const notes = JSON.parse(notesStr);
        if (!Array.isArray(notes)) return;

        // 计算今天的时间戳范围（当天0点到现在）
        const now = new Date();
        const today = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate()
        ).getTime();

        // 筛选今天的冲煮记录
        const todayNotes = notes.filter(note => note.timestamp >= today);

        // 计算今日消耗的咖啡量
        let consumption = 0;
        let cost = 0;
        let espressoConsumption = 0;
        let espressoCost = 0;
        let filterConsumption = 0;
        let filterCost = 0;
        let omniConsumption = 0;
        let omniCost = 0;

        todayNotes.forEach(note => {
          // 只排除容量调整记录，快捷扣除记录需要计入统计
          if (note.source === 'capacity-adjustment') {
            return;
          }

          // 处理快捷扣除记录
          if (note.source === 'quick-decrement' && note.quickDecrementAmount) {
            const coffeeAmount = note.quickDecrementAmount;
            if (!isNaN(coffeeAmount)) {
              consumption += coffeeAmount;

              // 根据咖啡豆类型判断消耗分类
              const bean = note.coffeeBeanInfo?.name
                ? beans.find(b => b.name === note.coffeeBeanInfo?.name)
                : null;

              const isEspresso = bean?.beanType === 'espresso';
              const isFilter = bean?.beanType === 'filter';
              const isOmni = bean?.beanType === 'omni';

              // 分别统计手冲和意式消耗
              if (isEspresso) {
                espressoConsumption += coffeeAmount;
              } else if (isFilter) {
                filterConsumption += coffeeAmount;
              } else if (isOmni) {
                omniConsumption += coffeeAmount;
              }

              // 计算花费
              if (note.coffeeBeanInfo?.name) {
                // 找到对应的豆子计算价格
                const bean = beans.find(
                  b => b.name === note.coffeeBeanInfo?.name
                );
                if (bean && bean.price && bean.capacity) {
                  // 清理价格和容量数据，移除非数字字符
                  const price = parseFloat(
                    bean.price.toString().replace(/[^\d.]/g, '')
                  );
                  const capacity = parseFloat(
                    bean.capacity.toString().replace(/[^\d.]/g, '')
                  );
                  if (!isNaN(price) && !isNaN(capacity) && capacity > 0) {
                    const noteCost = (coffeeAmount * price) / capacity;
                    cost += noteCost;

                    // 分别统计手冲和意式花费
                    if (isEspresso) {
                      espressoCost += noteCost;
                    } else if (isFilter) {
                      filterCost += noteCost;
                    } else if (isOmni) {
                      omniCost += noteCost;
                    }
                  }
                }
              }
            }
          } else if (note.params?.coffee) {
            // 处理普通冲煮笔记
            // 提取咖啡量中的数字部分
            const match = note.params.coffee.match(/(\d+(\.\d+)?)/);
            if (match) {
              const coffeeAmount = parseFloat(match[0]);
              if (!isNaN(coffeeAmount)) {
                consumption += coffeeAmount;

                // 根据咖啡豆类型判断消耗分类
                const bean = note.coffeeBeanInfo?.name
                  ? beans.find(b => b.name === note.coffeeBeanInfo?.name)
                  : null;

                const isEspresso = bean?.beanType === 'espresso';
                const isFilter = bean?.beanType === 'filter';
                const isOmni = bean?.beanType === 'omni';

                // 分别统计手冲和意式消耗
                if (isEspresso) {
                  espressoConsumption += coffeeAmount;
                } else if (isFilter) {
                  filterConsumption += coffeeAmount;
                } else if (isOmni) {
                  omniConsumption += coffeeAmount;
                }

                // 计算花费
                if (note.coffeeBeanInfo?.name) {
                  // 找到对应的豆子计算价格
                  const bean = beans.find(
                    b => b.name === note.coffeeBeanInfo?.name
                  );
                  if (bean && bean.price && bean.capacity) {
                    // 清理价格和容量数据，移除非数字字符
                    const price = parseFloat(
                      bean.price.toString().replace(/[^\d.]/g, '')
                    );
                    const capacity = parseFloat(
                      bean.capacity.toString().replace(/[^\d.]/g, '')
                    );
                    if (!isNaN(price) && !isNaN(capacity) && capacity > 0) {
                      const noteCost = (coffeeAmount * price) / capacity;
                      cost += noteCost;

                      // 分别统计手冲和意式花费
                      if (isEspresso) {
                        espressoCost += noteCost;
                      } else if (isFilter) {
                        filterCost += noteCost;
                      } else if (isOmni) {
                        omniCost += noteCost;
                      }
                    }
                  }
                }
              }
            }
          }
        });

        setTodayConsumption(consumption);
        setTodayCost(cost);
        setTodayEspressoConsumption(espressoConsumption);
        setTodayEspressoCost(espressoCost);
        setTodayFilterConsumption(filterConsumption);
        setTodayFilterCost(filterCost);
        setTodayOmniConsumption(omniConsumption);
        setTodayOmniCost(omniCost);
      } catch (err) {
        console.error('加载今日消耗数据失败:', err);
      }
    };

    loadTodayConsumption();

    // 添加事件监听，当冲煮记录更新时重新计算
    const handleStorageChange = (e: CustomEvent) => {
      if (e.detail?.key === 'brewingNotes') {
        loadTodayConsumption();
      }
    };

    window.addEventListener(
      'customStorageChange',
      handleStorageChange as EventListener
    );
    window.addEventListener(
      'storage:changed',
      handleStorageChange as EventListener
    );

    return () => {
      window.removeEventListener(
        'customStorageChange',
        handleStorageChange as EventListener
      );
      window.removeEventListener(
        'storage:changed',
        handleStorageChange as EventListener
      );
    };
  }, [beans]);

  return {
    consumption: todayConsumption,
    cost: todayCost,
    espressoConsumption: todayEspressoConsumption,
    espressoCost: todayEspressoCost,
    filterConsumption: todayFilterConsumption,
    filterCost: todayFilterCost,
    omniConsumption: todayOmniConsumption,
    omniCost: todayOmniCost,
  };
};
